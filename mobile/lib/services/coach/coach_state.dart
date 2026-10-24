import 'package:flutter/widgets.dart';
import 'package:flutter/scheduler.dart';
import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../models/workout.dart';
import '../../services/exercise_match.dart';
import '../../state/fit_state.dart';
import 'coach_supabase.dart';

/// Central state manager for CoachOS coaching features.
///
/// Implements an ONLINE-FIRST, OFFLINE-SECOND architecture:
/// 1. Actions try direct cloud communication first.
/// 2. If network fails or is absent, changes fall back safely to a local
///    offline queue and flush automatically when connectivity returns.
/// 3. Supabase Realtime delivers instantaneous coach updates without polling.
class CoachState extends ChangeNotifier with WidgetsBindingObserver {
  CoachState._();
  static final CoachState instance = CoachState._();

  // Keys for SharedPreferences
  static const _clientIdKey = 'coach_client_id';
  static const _coachIdKey = 'coach_id';
  static const _coachNameKey = 'coach_name';
  static const _coachEmailKey = 'coach_email';
  static const _lastSyncKey = 'coach_last_sync';
  static const _pendingSyncsKey = 'coach_pending_syncs';

  SharedPreferences? _prefs;
  String? _clientId;
  String? _coachId;
  String? _coachName;
  String? _coachEmail;
  DateTime? _lastSync;
  List<Map<String, dynamic>> _pendingSyncs = [];
  List<Map<String, dynamic>> _assignedPrograms = [];
  List<Map<String, dynamic>> get assignedPrograms => _assignedPrograms;
  bool _syncing = false;
  Timer? _syncRetryTimer;

  // Throttling for health steps sync
  int? _lastSyncedSteps;
  DateTime? _lastSyncedStepsTime;

  // Getters
  bool get isSignedIn => CoachSupabase.instance.isSignedIn;
  bool get hasCoach => _clientId != null && _clientId!.isNotEmpty;
  bool get isClient => isSignedIn; // Signed-in users are CoachOS athletes
  bool get isSolo => !isSignedIn;
  bool get isSyncing => _syncing;

  String? get clientId => _clientId;
  String? get coachId => _coachId;
  String? get coachName => _coachName;
  String? get coachEmail => _coachEmail;
  DateTime? get lastSync => _lastSync;
  int get pendingCount => _pendingSyncs.length;

  String? get userEmail => CoachSupabase.instance.userEmail;
  String? get athleteName =>
      (CoachSupabase.instance.client.auth.currentUser?.userMetadata?['full_name'] as String?) ??
      (CoachSupabase.instance.client.auth.currentUser?.userMetadata?['name'] as String?);


  // Initialization (Fast & Non-blocking)


  void _safeNotify() {
    final binding = WidgetsBinding.instance;
    if (binding.schedulerPhase == SchedulerPhase.idle) {
      notifyListeners();
    } else {
      binding.addPostFrameCallback((_) {
        notifyListeners();
      });
    }
  }

  Future<void> init() async {
    WidgetsBinding.instance.addObserver(this);
    _prefs = await SharedPreferences.getInstance();
    final rawClientId = _prefs?.getString(_clientIdKey);
    _clientId = (rawClientId != null && rawClientId.trim().isNotEmpty) ? rawClientId.trim() : null;

    final rawCoachId = _prefs?.getString(_coachIdKey);
    _coachId = (rawCoachId != null && rawCoachId.trim().isNotEmpty) ? rawCoachId.trim() : null;

    _coachName = _prefs?.getString(_coachNameKey);
    _coachEmail = _prefs?.getString(_coachEmailKey);

    final lastSyncMs = _prefs?.getInt(_lastSyncKey);
    if (lastSyncMs != null) {
      _lastSync = DateTime.fromMillisecondsSinceEpoch(lastSyncMs);
    }

    final pendingRaw = _prefs?.getString(_pendingSyncsKey);
    if (pendingRaw != null) {
      try {
        final decoded = jsonDecode(pendingRaw);
        if (decoded is List) {
          _pendingSyncs = decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        }
      } catch (e) {
        debugPrint('CoachState: error decoding pending syncs: $e');
        _pendingSyncs = [];
      }
    }

    // Initialize Supabase in background
    unawaited(_initSupabaseInBackground());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && isSignedIn) {
      unawaited(syncAll());
    }
  }

  Future<void> _initSupabaseInBackground() async {
    try {
      await CoachSupabase.instance.init();
      if (isSignedIn) {
        if (_clientId != null) {
          _setupRealtime();
        }
        await refreshCoachLink();
        await flushSyncs();
        await syncAssignedPrograms();
      }
    } catch (e) {
      debugPrint('CoachState: Background init error: $e');
    }
  }

  void _setupRealtime() {
    if (_clientId == null || _clientId!.trim().isEmpty) return;
    CoachSupabase.instance.subscribeToRealtime(
      clientId: _clientId!.trim(),
      onMessage: () {
        _safeNotify();
      },
      onProgramUpdate: () {
        debugPrint('CoachState: Realtime program update triggered');
        syncAssignedPrograms();
      },
    );
  }

  // Auth Operations

  /// Sign up a new athlete.
  Future<String?> signUp({
    required String email,
    required String password,
    required String fullName,
  }) async {
    try {
      await CoachSupabase.instance.init();
      final res = await CoachSupabase.instance.signUp(
        email: email,
        password: password,
        fullName: fullName,
      );
      if (res.user != null) {
        await CoachSupabase.instance.ensureProfile(
          fullName: fullName,
          email: email,
        );
        _safeNotify();
      }
      return null;
    } catch (e) {
      return e.toString();
    }
  }

  /// Sign in with existing athlete account.
  Future<String?> signIn({
    required String email,
    required String password,
  }) async {
    try {
      await CoachSupabase.instance.init();
      await CoachSupabase.instance.signIn(
        email: email,
        password: password,
      );
      await refreshCoachLink();
      await flushSyncs();
      await syncAssignedPrograms();
      _safeNotify();
      return null;
    } catch (e) {
      return e.toString();
    }
  }

  /// Sign out athlete.
  Future<void> signOut() async {
    try {
      await CoachSupabase.instance.signOut();
    } catch (_) {}
    _clientId = null;
    _coachId = null;
    _coachName = null;
    _coachEmail = null;
    _lastSync = null;
    _pendingSyncs.clear();
    await _prefs?.remove(_clientIdKey);
    await _prefs?.remove(_coachIdKey);
    await _prefs?.remove(_coachNameKey);
    await _prefs?.remove(_coachEmailKey);
    await _prefs?.remove(_lastSyncKey);
    await _prefs?.remove(_pendingSyncsKey);
    _safeNotify();
  }

  // Coach Link

  /// Accept a coach invitation token.
  Future<String?> acceptInvite(String token) async {
    try {
      final invite = await CoachSupabase.instance.acceptInvite(token);
      if (invite == null) return 'Invalid or expired invite';
      await refreshCoachLink();
      await flushSyncs();
      await syncAssignedPrograms();
      return null;
    } catch (e) {
      return e.toString();
    }
  }

  /// Refresh coach link info from server.
  Future<void> refreshCoachLink() async {
    try {
      final link = await CoachSupabase.instance.getMyCoachLink();
      if (link != null) {
        final rawClientId = link['id'] as String?;
        if (rawClientId != null && rawClientId.trim().isNotEmpty) {
          _clientId = rawClientId.trim();
          await _prefs?.setString(_clientIdKey, _clientId!);
        }
        final rawCoachId = link['coach_id'] as String?;
        if (rawCoachId != null && rawCoachId.trim().isNotEmpty) {
          _coachId = rawCoachId.trim();
          await _prefs?.setString(_coachIdKey, _coachId!);
        }
        final coach = link['profiles'] as Map<String, dynamic>?;
        _coachName = coach?['full_name'] as String?;
        _coachEmail = coach?['email'] as String?;
        if (_coachName != null && _coachName!.isNotEmpty) {
          await _prefs?.setString(_coachNameKey, _coachName!);
        }
        if (_coachEmail != null && _coachEmail!.isNotEmpty) {
          await _prefs?.setString(_coachEmailKey, _coachEmail!);
        }
        _setupRealtime();
        _safeNotify();
      }
    } catch (e) {
      debugPrint('CoachState: refreshCoachLink failed: $e');
    }
  }

  // ONLINE FIRST, OFFLINE SECOND SYNC

  /// Save Daily Check-in: tries cloud first, falls back to offline queue.
  Future<bool> saveCheckInOnlineFirst({
    double? weight,
    double? sleepHours,
    int? steps,
    int? calories,
    int? protein,
    String? mood,
    String? notes,
    DateTime? date,
  }) async {
    final effectiveDate = date ?? DateTime.now();
    final payload = {
      'weight': weight,
      'sleep_hours': sleepHours,
      'steps': steps,
      'calories': calories,
      'protein': protein,
      'mood': mood,
      'notes': notes,
      'date': effectiveDate.toIso8601String(),
    };

    if (isSignedIn && _clientId != null) {
      try {
        await CoachSupabase.instance.syncCheckIn(
          clientId: _clientId!,
          weight: weight,
          sleepHours: sleepHours,
          steps: steps,
          calories: calories,
          protein: protein,
          mood: mood,
          notes: notes,
          date: effectiveDate,
        );
        _lastSync = DateTime.now();
        await _prefs?.setInt(_lastSyncKey, _lastSync!.millisecondsSinceEpoch);
        _safeNotify();
        return true; // Online sync succeeded
      } catch (e) {
        debugPrint('CoachState: Check-in online sync failed, queuing offline: $e');
      }
    }

    // Offline fallback
    queueSync('check_in', payload);
    return false;
  }

  /// Save Workout Session: tries cloud first, falls back to offline queue.
  Future<bool> saveWorkoutOnlineFirst({
    required String workoutName,
    String? programName,
    String? weekName,
    String? workoutId,
    required DateTime completedAt,
    required int durationSeconds,
    required Map<String, dynamic> sessionLogs,
    List<dynamic>? exercises,
    String? clientNotes,
  }) async {
    final payload = {
      'sync_key': '${completedAt.toUtc().microsecondsSinceEpoch}-${_clientId ?? 'pending'}',
      if (workoutId != null) 'workout_id': workoutId,
      'workout_name': workoutName,
      'program_name': programName,
      'week_name': weekName,
      'completed_at': completedAt.toIso8601String(),
      'duration_seconds': durationSeconds,
      'session_logs': sessionLogs,
      'exercises': exercises,
      'client_notes': clientNotes,
    };

    if (isSignedIn && (_clientId == null || _clientId!.trim().isEmpty)) {
      await refreshCoachLink();
    }

    if (isSignedIn && _clientId != null && _clientId!.trim().isNotEmpty) {
      try {
        await CoachSupabase.instance.syncWorkoutSession(
          clientId: _clientId!.trim(),
          syncKey: payload['sync_key'] as String,
          coachId: _coachId,
          workoutId: workoutId,
          workoutName: workoutName,
          programName: programName,
          weekName: weekName,
          completedAt: completedAt,
          durationSeconds: durationSeconds,
          sessionLogs: sessionLogs,
          exercises: exercises,
          clientNotes: clientNotes,
        );
        _lastSync = DateTime.now();
        await _prefs?.setInt(_lastSyncKey, _lastSync!.millisecondsSinceEpoch);
        _safeNotify();
        return true; // Online sync succeeded
      } catch (e, stack) {
        debugPrint('CoachState: Workout online sync failed, queuing offline: $e\n$stack');
      }
    }

    // Offline fallback
    queueSync('workout', payload);
    return false;
  }

  /// Save Measurements: tries cloud first, falls back to offline queue.
  Future<bool> saveMeasurementsOnlineFirst({
    double? weight,
    double? waist,
    double? chest,
    double? arms,
    double? legs,
    DateTime? date,
  }) async {
    final effectiveDate = date ?? DateTime.now();
    final payload = {
      'weight': weight,
      'waist': waist,
      'chest': chest,
      'arms': arms,
      'legs': legs,
      'date': effectiveDate.toIso8601String(),
    };

    if (isSignedIn && _clientId != null) {
      try {
        await CoachSupabase.instance.syncMeasurements(
          clientId: _clientId!,
          weight: weight,
          waist: waist,
          chest: chest,
          arms: arms,
          legs: legs,
          date: effectiveDate,
        );
        _lastSync = DateTime.now();
        await _prefs?.setInt(_lastSyncKey, _lastSync!.millisecondsSinceEpoch);
        _safeNotify();
        return true;
      } catch (e) {
        debugPrint('CoachState: Measurements online sync failed, queuing offline: $e');
      }
    }

    queueSync('measurements', payload);
    return false;
  }

  /// Sync steps from health app (throttled).
  Future<void> syncSteps(int steps) async {
    if (steps <= 0 || _lastSyncedSteps == steps) return;
    if (_lastSyncedStepsTime != null &&
        DateTime.now().difference(_lastSyncedStepsTime!).inMinutes < 2) {
      return;
    }
    _lastSyncedSteps = steps;
    _lastSyncedStepsTime = DateTime.now();

    await saveCheckInOnlineFirst(steps: steps);
  }

  // Offline Sync Queue Management

  void queueSync(String type, Map<String, dynamic> data) {
    _pendingSyncs.add({
      'type': type,
      'data': data,
      'queued_at': DateTime.now().toIso8601String(),
    });
    _savePendingSyncs();
    _scheduleSyncRetries();
    _safeNotify();
  }

  void _scheduleSyncRetries() {
    if (_pendingSyncs.isEmpty || _syncRetryTimer != null) return;
    _syncRetryTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_pendingSyncs.isEmpty) {
        _syncRetryTimer?.cancel();
        _syncRetryTimer = null;
      } else if (isSignedIn) {
        unawaited(flushSyncs());
      }
    });
  }

  /// Flush pending offline changes to cloud.
  Future<int> flushSyncs() async {
    if (_syncing || _pendingSyncs.isEmpty || !isSignedIn) {
      return 0;
    }
    if (_clientId == null || _clientId!.trim().isEmpty) {
      await refreshCoachLink();
      if (_clientId == null || _clientId!.trim().isEmpty) return 0;
    }
    _syncing = true;

    int synced = 0;
    final failed = <Map<String, dynamic>>[];

    for (final item in _pendingSyncs) {
      try {
        final type = item['type'] as String;
        final rawData = item['data'];
        final data = rawData is Map ? Map<String, dynamic>.from(rawData) : <String, dynamic>{};
        switch (type) {
          case 'check_in':
            await CoachSupabase.instance.syncCheckIn(
              clientId: _clientId!.trim(),
              weight: (data['weight'] as num?)?.toDouble(),
              sleepHours: (data['sleep_hours'] as num?)?.toDouble(),
              steps: (data['steps'] as num?)?.toInt(),
              calories: (data['calories'] as num?)?.toInt(),
              protein: (data['protein'] as num?)?.toInt(),
              mood: data['mood'] as String?,
              notes: data['notes'] as String?,
              date: data['date'] != null ? DateTime.tryParse(data['date'] as String) : null,
            );
          case 'measurements':
            await CoachSupabase.instance.syncMeasurements(
              clientId: _clientId!.trim(),
              weight: (data['weight'] as num?)?.toDouble(),
              waist: (data['waist'] as num?)?.toDouble(),
              chest: (data['chest'] as num?)?.toDouble(),
              arms: (data['arms'] as num?)?.toDouble(),
              legs: (data['legs'] as num?)?.toDouble(),
              date: data['date'] != null ? DateTime.tryParse(data['date'] as String) : null,
            );
          case 'workout':
            Map<String, dynamic> sessionLogs = {};
            final rawLogs = data['session_logs'];
            if (rawLogs is Map) {
              sessionLogs = rawLogs.map((k, v) => MapEntry(k.toString(), v));
            }
            List<dynamic>? exercises;
            final rawExercises = data['exercises'];
            if (rawExercises is List) {
              exercises = List<dynamic>.from(rawExercises);
            }

            await CoachSupabase.instance.syncWorkoutSession(
              clientId: _clientId!.trim(),
              syncKey: (data['sync_key'] as String?) ??
                  '${(data['completed_at'] as String?) ?? ''}-${data['workout_id'] ?? data['workout_name'] ?? 'session'}',
              coachId: _coachId,
              workoutId: data['workout_id'] as String?,
              workoutName: (data['workout_name'] as String?) ?? 'Workout Session',
              programName: data['program_name'] as String?,
              weekName: data['week_name'] as String?,
              completedAt: data['completed_at'] != null 
                  ? DateTime.parse(data['completed_at'] as String) 
                  : DateTime.now(),
              durationSeconds: (data['duration_seconds'] as num?)?.toInt() ?? 0,
              sessionLogs: sessionLogs,
              exercises: exercises,
              clientNotes: data['client_notes'] as String?,
            );
          case 'photo':
            await CoachSupabase.instance.syncProgressPhoto(
              clientId: _clientId!.trim(),
              storagePath: data['storage_path'] as String,
              poseType: (data['pose_type'] as String?) ?? 'front',
              date: data['date'] != null ? DateTime.tryParse(data['date'] as String) : null,
            );
        }
        synced++;
      } catch (e, stack) {
        debugPrint('CoachState: sync failed for item: $e\n$stack');
        failed.add(item);
      }
    }

    _pendingSyncs = failed;
    _lastSync = DateTime.now();
    await _prefs?.setInt(_lastSyncKey, _lastSync!.millisecondsSinceEpoch);
    _savePendingSyncs();
    if (_pendingSyncs.isEmpty) {
      _syncRetryTimer?.cancel();
      _syncRetryTimer = null;
    } else {
      _scheduleSyncRetries();
    }
    _syncing = false;
    _safeNotify();
    return synced;
  }

  // Pull Coach Programs into GymMane

  /// Pull coach-assigned programs from CoachOS.
  Future<int> syncAssignedPrograms() async {
    if (!isSignedIn || _clientId == null) return 0;
    try {
      final programs = await CoachSupabase.instance.getAssignedPrograms(_clientId!);
      _assignedPrograms = List<Map<String, dynamic>>.from(programs);
      int importedCount = 0;

      for (final prog in programs) {
        final progName = prog['name'] as String? ?? 'Coach Program';
        final weeks = prog['program_weeks'] as List<dynamic>? ?? [];

        for (final w in weeks) {
          final weekNum = w['week_number'] ?? 1;
          final workouts = w['workouts'] as List<dynamic>? ?? [];

          for (final wk in workouts) {
            final wkId = 'coach_${wk['id']}';
            final wkName = wk['name'] as String? ?? 'Workout';
            final exList = wk['exercises'] as List<dynamic>? ?? [];

            final exerciseIds = <String>[];
            final setsMap = <String, int>{};
            final planMap = <String, List<PlannedSet>>{};
            final restMap = <String, int>{};

            for (final ex in exList) {
              final exName = ex['name'] as String? ?? '';
              final matched = matchExercise(exName, fit.allExercises);
              final exId = matched?.id ??
                  exName.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '_');

              exerciseIds.add(exId);
              final setCount = (ex['sets'] as num?)?.toInt() ?? 3;
              setsMap[exId] = setCount;

              final repsStr = ex['reps']?.toString() ?? '10';
              final parsedReps = int.tryParse(repsStr.replaceAll(RegExp(r'[^0-9]'), '')) ?? 10;
              final loadTarget = ex['load_target']?.toString();
              final parsedWeight = loadTarget != null
                  ? double.tryParse(loadTarget.replaceAll(RegExp(r'[^0-9.]'), ''))
                  : null;

              planMap[exId] = List.generate(
                setCount,
                (_) => PlannedSet(reps: parsedReps, weightKg: parsedWeight),
              );

              final restStr = ex['rest_time']?.toString();
              if (restStr != null) {
                final restSec = int.tryParse(restStr.replaceAll(RegExp(r'[^0-9]'), ''));
                if (restSec != null && restSec > 0) {
                  restMap[exId] = restSec;
                }
              }
            }

            final existingIdx = fit.routines.indexWhere((r) => r.id == wkId);
            final newRoutine = Routine(
              wkId,
              wkName,
              exerciseIds,
              sets: setsMap,
              plan: planMap,
              rest: restMap,
              group: '$progName (W$weekNum)',
            );

            if (existingIdx >= 0) {
              fit.routines[existingIdx] = newRoutine;
            } else {
              fit.routines.add(newRoutine);
            }
            importedCount++;
          }
        }
      }

      if (importedCount > 0) {
        fit.persistNow();
        _safeNotify();
      }
      return importedCount;
    } catch (e) {
      debugPrint('CoachState: syncAssignedPrograms error: $e');
      return 0;
    }
  }

  Future<void> syncAll() async {
    await refreshCoachLink();
    await flushSyncs();
    await syncAssignedPrograms();
  }

  void _savePendingSyncs() {
    _prefs?.setString(_pendingSyncsKey, jsonEncode(_pendingSyncs));
  }
}
