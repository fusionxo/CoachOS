import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Supabase client wrapper for CoachOS cloud integration.
///
/// Provides online-first operations with reliable timeout safeguards
/// and Supabase Realtime event listeners for instantaneous messaging
/// and coach program updates.
class CoachSupabase {
  CoachSupabase._();
  static final CoachSupabase instance = CoachSupabase._();

  static const _url = 'https://kzzhqshrkkfdadggshdw.supabase.co';
  static const _anonKey = 'sb_publishable_KmjQ31Ad1HIR98R5Bvw7TQ_mohBBbO7';
  static const _netTimeout = Duration(seconds: 8);

  bool _initialized = false;
  bool get isInitialized => _initialized;
  Future<void>? _initializing;

  SupabaseClient get client => Supabase.instance.client;
  Session? get session => _initialized ? client.auth.currentSession : null;
  User? get user => _initialized ? client.auth.currentUser : null;
  bool get isSignedIn => session != null;

  String? get userId => user?.id;
  String? get userEmail => user?.email;

  RealtimeChannel? _realtimeChannel;

  /// Initialize Supabase. Safe to call multiple times.
  Future<void> init() {
    if (_initialized) return Future<void>.value();
    return _initializing ??= _init();
  }

  Future<void> _init() async {
    try {
      await Supabase.initialize(
        url: _url,
        anonKey: _anonKey, // ignore: deprecated_member_use
        authOptions: const FlutterAuthClientOptions(
          authFlowType: AuthFlowType.pkce,
        ),
      ).timeout(const Duration(seconds: 20));
      _initialized = true;
    } catch (e) {
      // Supabase.initialize can throw when a prior timed-out initialization
      // completed in the background. Treat it as initialized only if the
      // singleton client is actually available; otherwise leave it retryable.
      try {
        Supabase.instance.client;
        _initialized = true;
        debugPrint('CoachSupabase: using an already initialized client: $e');
      } catch (_) {
        _initialized = false;
        debugPrint('CoachSupabase: init failed and can be retried: $e');
        rethrow;
      }
    } finally {
      _initializing = null;
    }
  }

  // -- Auth Methods ------------------------------------------

  /// Sign up a new client user with email and password.
  Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String fullName,
  }) async {
    return client.auth
        .signUp(
          email: email,
          password: password,
          data: {
            'full_name': fullName,
            'role': 'client',
          },
        )
        .timeout(_netTimeout);
  }

  /// Sign in with email and password.
  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    return client.auth
        .signInWithPassword(
          email: email,
          password: password,
        )
        .timeout(_netTimeout);
  }

  /// Sign out and clear session.
  Future<void> signOut() async {
    unsubscribeRealtime();
    await client.auth.signOut().timeout(const Duration(seconds: 4));
  }

  /// Send password reset email.
  Future<void> resetPassword(String email) async {
    await client.auth.resetPasswordForEmail(email).timeout(_netTimeout);
  }

  // -- Profile Methods ---------------------------------------

  /// Fetch user profile from CoachOS.
  Future<Map<String, dynamic>?> getProfile() async {
    final uid = userId;
    if (uid == null) return null;
    return client
        .from('profiles')
        .select()
        .eq('id', uid)
        .maybeSingle()
        .timeout(_netTimeout);
  }

  /// Ensure the profile row exists.
  Future<void> ensureProfile({
    required String fullName,
    required String email,
  }) async {
    final uid = userId;
    if (uid == null) return;
    await client
        .from('profiles')
        .upsert({
          'id': uid,
          'full_name': fullName,
          'email': email,
          'role': 'client',
        })
        .timeout(_netTimeout);
  }

  /// Update athlete profile metadata (height, weight, goal, experience).
  Future<void> updateAthleteProfile({
    required String fullName,
    String? height,
    String? startingWeight,
    String? goal,
    String? experienceLevel,
  }) async {
    final uid = userId;
    if (uid == null) return;

    // 1. Update profiles table
    await client
        .from('profiles')
        .update({
          'full_name': fullName,
        })
        .eq('id', uid)
        .timeout(_netTimeout);

    // 2. If client record exists, update client record
    final clientRow = await client
        .from('clients')
        .select('id')
        .eq('user_id', uid)
        .maybeSingle()
        .timeout(_netTimeout);

    if (clientRow != null) {
      final updates = <String, dynamic>{
        'name': fullName,
        if (height != null) 'height': height,
        if (startingWeight != null) 'starting_weight': startingWeight,
        if (goal != null) 'goal': goal,
        if (experienceLevel != null) 'experience_level': experienceLevel,
      };
      await client
          .from('clients')
          .update(updates)
          .eq('id', clientRow['id'])
          .timeout(_netTimeout);
    }
  }

  // -- Coach Link Methods ------------------------------------

  /// Accept a coach invitation using the invite token.
  Future<Map<String, dynamic>?> acceptInvite(String token) async {
    final uid = userId;
    if (uid == null) return null;

    final invite = await client
        .from('client_invites')
        .select('*, clients(*)')
        .eq('token', token.trim())
        .isFilter('accepted_at', null)
        .maybeSingle()
        .timeout(_netTimeout);

    if (invite == null) return null;

    final expiresAt = DateTime.parse(invite['expires_at'] as String);
    if (DateTime.now().toUtc().isAfter(expiresAt)) return null;

    final clientId = invite['client_id'] as String;

    await client
        .from('clients')
        .update({'user_id': uid})
        .eq('id', clientId)
        .timeout(_netTimeout);

    await client
        .from('client_invites')
        .update({
          'accepted_at': DateTime.now().toUtc().toIso8601String(),
        })
        .eq('id', invite['id'] as String)
        .timeout(_netTimeout);

    return invite;
  }

  /// Get the client's linked coach info.
  Future<Map<String, dynamic>?> getMyCoachLink() async {
    final uid = userId;
    if (uid == null) return null;

    Map<String, dynamic>? clientRow;

    // 1. Try finding client record linked by user_id
    try {
      final res = await client
          .from('clients')
          .select('*')
          .eq('user_id', uid)
          .maybeSingle()
          .timeout(_netTimeout);
      if (res != null) {
        clientRow = Map<String, dynamic>.from(res);
      }
    } catch (e) {
      debugPrint('CoachSupabase: getMyCoachLink by user_id error: $e');
    }

    // 2. If not found by user_id, search by email and auto-link user_id
    final email = userEmail;
    if (clientRow == null && email != null && email.trim().isNotEmpty) {
      try {
        final res = await client
            .from('clients')
            .select('*')
            .ilike('email', email.trim())
            .maybeSingle()
            .timeout(_netTimeout);

        if (res != null) {
          clientRow = Map<String, dynamic>.from(res);
          final cId = clientRow['id'] as String?;
          if (cId != null) {
            try {
              await client
                  .from('clients')
                  .update({'user_id': uid})
                  .eq('id', cId)
                  .timeout(_netTimeout);
              clientRow['user_id'] = uid;
              debugPrint('CoachSupabase: successfully linked user_id $uid to client $cId');
            } catch (e) {
              debugPrint('CoachSupabase: auto-linking client user_id error: $e');
            }
          }
        }
      } catch (e) {
        debugPrint('CoachSupabase: getMyCoachLink by email error: $e');
      }
    }

    // 3. If still not found, check if this user is a coach who owns clients
    if (clientRow == null) {
      try {
        final coachClients = await client
            .from('clients')
            .select('*')
            .eq('coach_id', uid)
            .limit(1)
            .timeout(_netTimeout);
        if (coachClients.isNotEmpty) {
          clientRow = Map<String, dynamic>.from(coachClients.first as Map);
        }
      } catch (e) {
        debugPrint('CoachSupabase: getMyCoachLink by coach_id error: $e');
      }
    }

    if (clientRow == null) return null;

    // 4. Safely attach coach profile details without fragile foreign-key query syntax
    final coachId = clientRow['coach_id'] as String?;
    if (coachId != null) {
      try {
        final coachProfile = await client
            .from('profiles')
            .select('full_name, email')
            .eq('id', coachId)
            .maybeSingle()
            .timeout(_netTimeout);
        if (coachProfile != null) {
          clientRow['profiles'] = coachProfile;
        }
      } catch (e) {
        debugPrint('CoachSupabase: getMyCoachLink coach profile error: $e');
      }
    }

    return clientRow;
  }

  // -- Sync Methods (Online First) ----------------------------

  /// Sync a daily check-in (weight, sleep, steps, mood, nutrition) to CoachOS.
  Future<void> syncCheckIn({
    required String clientId,
    double? weight,
    double? sleepHours,
    int? steps,
    int? calories,
    int? protein,
    String? mood,
    String? notes,
    DateTime? date,
  }) async {
    await client
        .from('check_ins')
        .insert({
          'client_id': clientId,
          if (weight != null) 'weight': weight,
          if (sleepHours != null) 'sleep_hours': sleepHours,
          if (steps != null) 'steps': steps,
          if (calories != null) 'calories': calories,
          if (protein != null) 'protein': protein,
          if (mood != null) 'mood': mood,
          if (notes != null) 'notes': notes,
          'created_at': (date ?? DateTime.now()).toUtc().toIso8601String(),
        })
        .timeout(_netTimeout);
  }

  /// Sync body measurements to CoachOS.
  Future<void> syncMeasurements({
    required String clientId,
    double? weight,
    double? waist,
    double? chest,
    double? arms,
    double? legs,
    DateTime? date,
  }) async {
    await client
        .from('measurements')
        .insert({
          'client_id': clientId,
          if (weight != null) 'weight': weight,
          if (waist != null) 'waist': waist,
          if (chest != null) 'chest': chest,
          if (arms != null) 'arms': arms,
          if (legs != null) 'legs': legs,
          'created_at': (date ?? DateTime.now()).toUtc().toIso8601String(),
        })
        .timeout(_netTimeout);
  }

  /// Sync a completed workout session to CoachOS.
  Future<void> syncWorkoutSession({
    required String clientId,
    required String syncKey,
    String? coachId,
    String? workoutId,
    required String workoutName,
    String? programName,
    String? weekName,
    required DateTime completedAt,
    required int durationSeconds,
    required Map<String, dynamic> sessionLogs,
    List<dynamic>? exercises,
    String? clientNotes,
  }) async {
    final cleanClientId = clientId.trim();
    if (cleanClientId.isEmpty) {
      throw ArgumentError('clientId cannot be empty');
    }

    final insertPayload = <String, dynamic>{
      'sync_key': syncKey,
      'client_id': cleanClientId,
      if (coachId != null && coachId.trim().isNotEmpty) 'coach_id': coachId.trim(),
      if (workoutId != null && workoutId.trim().isNotEmpty) 'workout_id': workoutId.trim(),
      'workout_name': workoutName,
      if (programName != null && programName.trim().isNotEmpty) 'program_name': programName.trim(),
      if (weekName != null && weekName.trim().isNotEmpty) 'week_name': weekName.trim(),
      'completed_at': completedAt.toUtc().toIso8601String(),
      'duration_seconds': durationSeconds,
      'session_logs': sessionLogs,
      'exercises': exercises ?? [],
      if (clientNotes != null && clientNotes.trim().isNotEmpty) 'client_notes': clientNotes.trim(),
    };

    // 1. Insert into workout_session_logs
    await client
        .from('workout_session_logs')
        .upsert(insertPayload, onConflict: 'sync_key', ignoreDuplicates: true)
        .timeout(_netTimeout);

    // 2. If assigned workout from coach, update workouts table status
    if (workoutId != null && workoutId.trim().isNotEmpty) {
      try {
        await client
            .from('workouts')
            .update({
              'status': 'Completed',
              'session_logs': sessionLogs,
              'completed_at': completedAt.toUtc().toIso8601String(),
            })
            .eq('id', workoutId.trim())
            .timeout(_netTimeout);
      } catch (e) {
        debugPrint('CoachSupabase: update workouts status warning: $e');
      }
    }
  }

  /// Sync progress photos record to CoachOS.
  Future<void> syncProgressPhoto({
    required String clientId,
    required String storagePath,
    required String poseType,
    DateTime? date,
  }) async {
    final photoDay = date ?? DateTime.now();
    await client
        .from('progress_photos')
        .upsert({
          'client_id': clientId,
          'storage_path': storagePath,
          'pose_type': poseType,
          'created_at': DateTime.utc(photoDay.year, photoDay.month, photoDay.day, 12).toIso8601String(),
        }, onConflict: 'client_id,storage_path')
        .timeout(_netTimeout);
  }

  /// Upload a locally stored progress photo under the workspace/client path
  /// required by Storage RLS, then persist its metadata for coach dashboards.
  Future<void> uploadProgressPhoto({
    required String workspaceId,
    required String clientId,
    required String localPath,
    required String poseType,
    required DateTime date,
  }) async {
    final filename = localPath.split(RegExp(r'[/\\]')).last;
    final storagePath = '$workspaceId/$clientId/$filename';
    final extension = filename.contains('.') ? filename.split('.').last.toLowerCase() : '';
    final contentType = switch (extension) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      'heic' => 'image/heic',
      _ => 'image/jpeg',
    };
    await client.storage
        .from('progress-photos')
        .upload(storagePath, File(localPath), fileOptions: FileOptions(upsert: true, contentType: contentType))
        .timeout(_netTimeout);
    await syncProgressPhoto(clientId: clientId, storagePath: storagePath, poseType: poseType, date: date);
  }

  /// Keep one nutrition summary row per client per day for the coach check-in view.
  Future<void> syncNutritionSummary({
    required String clientId,
    required DateTime day,
    required int calories,
    required int protein,
    required int carbs,
    required int fats,
  }) async {
    final date = DateTime(day.year, day.month, day.day);
    await client.from('check_ins').upsert({
      'client_id': clientId,
      'nutrition_day': date.toIso8601String().substring(0, 10),
      'calories': calories,
      'protein': protein,
      'carbs': carbs,
      'fats': fats,
      'created_at': DateTime.utc(date.year, date.month, date.day, 12).toIso8601String(),
    }, onConflict: 'client_id,nutrition_day').timeout(_netTimeout);
  }

  // -- Coach-Assigned Programs -------------------------------

  /// Fetch programs assigned to this client by their coach.
  Future<List<Map<String, dynamic>>> getAssignedPrograms(String clientId) async {
    final res = await client
        .from('programs')
        .select('*, program_weeks(*, workouts(*, exercises(*)))')
        .eq('client_id', clientId)
        .order('created_at', ascending: false)
        .timeout(_netTimeout);
    return List<Map<String, dynamic>>.from(res);
  }

  // -- Real-Time Subscriptions -------------------------------

  /// Subscribe to real-time events for messages and programs.
  void subscribeToRealtime({
    required String clientId,
    VoidCallback? onMessage,
    VoidCallback? onProgramUpdate,
  }) {
    unsubscribeRealtime();

    try {
      _realtimeChannel = client.channel('coach_realtime_$clientId')
        ..onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'conversation_id',
            value: clientId,
          ),
          callback: (payload) {
            debugPrint('CoachSupabase: Realtime message update received');
            onMessage?.call();
          },
        )
        ..onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'programs',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'client_id',
            value: clientId,
          ),
          callback: (payload) {
            debugPrint('CoachSupabase: Realtime program update received');
            onProgramUpdate?.call();
          },
        )
        ..onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'clients',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'id', value: clientId),
          callback: (_) => onProgramUpdate?.call(),
        )
        ..onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'workouts',
          callback: (_) => onProgramUpdate?.call(),
        )
        ..subscribe();
    } catch (e) {
      debugPrint('CoachSupabase: Realtime subscription failed: $e');
    }
  }

  /// Cancel realtime subscription.
  void unsubscribeRealtime() {
    if (_realtimeChannel != null) {
      try {
        client.removeChannel(_realtimeChannel!);
      } catch (_) {}
      _realtimeChannel = null;
    }
  }

  // -- Messages ----------------------------------------------

  /// Stream of messages in real-time.
  Stream<List<Map<String, dynamic>>> getMessagesStream(String clientId) {
    return client
        .from('messages')
        .stream(primaryKey: ['id'])
        .eq('conversation_id', clientId)
        .order('created_at', ascending: true);
  }

  /// Fetch messages between client and coach.
  Future<List<Map<String, dynamic>>> getMessages(String clientId) async {
    final res = await client
        .from('messages')
        .select()
        .eq('conversation_id', clientId)
        .order('created_at', ascending: true)
        .timeout(_netTimeout);
    return List<Map<String, dynamic>>.from(res);
  }

  /// Send a message to the coach.
  Future<void> sendMessage({
    required String clientId,
    required String content,
  }) async {
    final uid = userId;
    if (uid == null) return;
    await client
        .from('messages')
        .insert({
          'conversation_id': clientId,
          'sender_id': uid,
          'content': content,
        })
        .timeout(_netTimeout);
  }
}
