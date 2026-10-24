import 'package:flutter/material.dart';
import 'package:phosphoricons_flutter/phosphoricons_flutter.dart';

import '../../services/coach/coach_state.dart';
import '../../state/fit_state.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_theme.dart';
import '../../widgets/ui_kit.dart';

/// Daily check-in screen for CoachOS client athletes.
/// Allows clients to log daily metrics (weight, sleep, steps, mood, nutrition)
/// which sync to the CoachOS coach web dashboard.
class DailyCheckInScreen extends StatefulWidget {
  const DailyCheckInScreen({super.key});

  @override
  State<DailyCheckInScreen> createState() => _DailyCheckInScreenState();
}

class _DailyCheckInScreenState extends State<DailyCheckInScreen> {
  final _weightController = TextEditingController();
  final _sleepController = TextEditingController();
  final _stepsController = TextEditingController();
  final _caloriesController = TextEditingController();
  final _proteinController = TextEditingController();
  final _notesController = TextEditingController();

  String _selectedMood = 'Good';
  bool _saving = false;
  String? _statusMessage;

  final _moods = const [
    ('Great', '??', 'High energy, ready to perform'),
    ('Good', '?', 'Solid recovery, feeling good'),
    ('Normal', '??', 'Average day, steady pace'),
    ('Low', '???', 'Fatigued, high stress/soreness'),
    ('Exhausted', '??', 'Need rest, under-recovered'),
  ];

  @override
  void initState() {
    super.initState();
    final latestWeight = fit.latestBodyweight?.kg;
    if (latestWeight != null && latestWeight > 0) {
      _weightController.text = latestWeight.toStringAsFixed(1);
    }
    if (fit.stepsOn) {
      if (fit.stepsToday > 0) {
        _stepsController.text = '${fit.stepsToday}';
      }
      fit.refreshSteps().then((_) {
        if (mounted && fit.stepsToday > 0 && (_stepsController.text.isEmpty || _stepsController.text == '0')) {
          setState(() {
            _stepsController.text = '${fit.stepsToday}';
          });
        }
      });
    }
  }

  @override
  void dispose() {
    _weightController.dispose();
    _sleepController.dispose();
    _stepsController.dispose();
    _caloriesController.dispose();
    _proteinController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _saving = true;
      _statusMessage = null;
    });

    final weight = double.tryParse(_weightController.text.trim());
    final sleep = double.tryParse(_sleepController.text.trim());
    final steps = int.tryParse(_stepsController.text.trim());
    final cals = int.tryParse(_caloriesController.text.trim());
    final protein = int.tryParse(_proteinController.text.trim());
    final notes = _notesController.text.trim();

    // If weight entered, also log to local GymMane fit state
    if (weight != null && weight > 0) {
      fit.addBodyweight(weight);
    }

    // Save Online First, fallback to offline queue
    final ok = await CoachState.instance.saveCheckInOnlineFirst(
      weight: weight,
      sleepHours: sleep,
      steps: steps,
      calories: cals,
      protein: protein,
      mood: _selectedMood,
      notes: notes.isEmpty ? null : notes,
      date: DateTime.now(),
    );

    if (mounted) {
      setState(() {
        _saving = false;
        _statusMessage = ok
            ? 'Check-in synced with Coach successfully!'
            : 'Saved offline. Will auto-sync when online.';
      });
      await Future.delayed(const Duration(milliseconds: 900));
      if (mounted) Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final gc = context.gc;
    return Scaffold(
      backgroundColor: gc.bg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(PhosphorIconsRegular.caretLeft, color: gc.text),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'Daily Check-in',
          style: AppTheme.f(18, weight: FontWeight.w700, color: gc.text),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SoftCard(
                color: const Color(0xFF1E2816),
                borderColor: const Color(0xFF3B561B),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFCEEE93).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        PhosphorIconsRegular.checkCircle,
                        color: Color(0xFFCEEE93),
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Daily Accountability',
                            style: AppTheme.f(14, weight: FontWeight.w700, color: Colors.white),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Logged data flows straight into your coach\'s review dashboard.',
                            style: AppTheme.f(11, color: const Color(0xFFC5C8B7)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Vitals (Weight, Sleep, Steps)
              Text('DAILY METRICS', style: AppTheme.f(11, weight: FontWeight.w700, color: gc.textTertiary)),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _metricField(
                      gc: gc,
                      controller: _weightController,
                      label: 'Morning Weight',
                      unit: fit.units,
                      icon: PhosphorIconsRegular.scales,
                      hint: '72.5',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _metricField(
                      gc: gc,
                      controller: _sleepController,
                      label: 'Sleep Duration',
                      unit: 'hrs',
                      icon: PhosphorIconsRegular.moon,
                      hint: '7.5',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _metricField(
                    gc: gc,
                    controller: _stepsController,
                    label: 'Estimated Steps',
                    unit: 'steps',
                    icon: PhosphorIconsRegular.sneakerMove,
                    hint: fit.stepsOn && fit.stepsToday > 0 ? '${fit.stepsToday}' : '8500',
                  ),
                  const SizedBox(height: 6),
                  if (fit.stepsOn)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Row(
                        children: [
                          Icon(PhosphorIconsFill.checkCircle, size: 14, color: gc.accent),
                          const SizedBox(width: 5),
                          Text(
                            'Auto-synced from Health Connect (${fit.stepsToday} steps)',
                            style: AppTheme.f(11, weight: FontWeight.w600, color: gc.accent),
                          ),
                          const Spacer(),
                          GestureDetector(
                            onTap: () async {
                              await fit.refreshSteps();
                              if (mounted && fit.stepsToday > 0) {
                                setState(() {
                                  _stepsController.text = '${fit.stepsToday}';
                                });
                              }
                            },
                            child: Text(
                              'Refresh',
                              style: AppTheme.f(11, weight: FontWeight.w700, color: gc.textSecondary),
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: GestureDetector(
                        onTap: () async {
                          final ok = await fit.setStepsOn(true);
                          if (ok && mounted) {
                            await fit.refreshSteps();
                            setState(() {
                              if (fit.stepsToday > 0) {
                                _stepsController.text = '${fit.stepsToday}';
                              }
                            });
                          }
                        },
                        child: Row(
                          children: [
                            Icon(PhosphorIconsRegular.sneakerMove, size: 14, color: gc.warn),
                            const SizedBox(width: 5),
                            Text(
                              'Enable Health Connect to auto-fill steps',
                              style: AppTheme.f(11, weight: FontWeight.w600, color: gc.warn),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),

              const SizedBox(height: 20),

              // Nutrition
              Text('NUTRITION (OPTIONAL)', style: AppTheme.f(11, weight: FontWeight.w700, color: gc.textTertiary)),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _metricField(
                      gc: gc,
                      controller: _caloriesController,
                      label: 'Total Calories',
                      unit: 'kcal',
                      icon: PhosphorIconsRegular.flame,
                      hint: '2400',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _metricField(
                      gc: gc,
                      controller: _proteinController,
                      label: 'Protein',
                      unit: 'g',
                      icon: PhosphorIconsRegular.egg,
                      hint: '160',
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // Mood & Energy
              Text('RECOVERY & MOOD', style: AppTheme.f(11, weight: FontWeight.w700, color: gc.textTertiary)),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _moods.map((m) {
                  final isSelected = _selectedMood == m.$1;
                  return ChoiceChip(
                    selected: isSelected,
                    onSelected: (_) => setState(() => _selectedMood = m.$1),
                    backgroundColor: gc.bgRaised,
                    selectedColor: const Color(0xFFCEEE93),
                    label: Text('${m.$2} ${m.$1}'),
                    labelStyle: AppTheme.f(
                      13,
                      weight: FontWeight.w600,
                      color: isSelected ? const Color(0xFF131F00) : gc.text,
                    ),
                  );
                }).toList(),
              ),

              const SizedBox(height: 20),

              // Notes for Coach
              Text('NOTES FOR COACH', style: AppTheme.f(11, weight: FontWeight.w700, color: gc.textTertiary)),
              const SizedBox(height: 10),
              TextField(
                controller: _notesController,
                maxLines: 3,
                style: AppTheme.f(14, color: gc.text),
                decoration: InputDecoration(
                  hintText: 'Any muscle soreness, schedule changes, or comments...',
                  hintStyle: AppTheme.f(13, color: gc.textTertiary),
                  filled: true,
                  fillColor: gc.bgRaised,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(color: gc.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(color: gc.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: const BorderSide(color: Color(0xFFCEEE93)),
                  ),
                ),
              ),

              const SizedBox(height: 24),

              if (_statusMessage != null) ...[
                Text(
                  _statusMessage!,
                  textAlign: TextAlign.center,
                  style: AppTheme.f(13, weight: FontWeight.w600, color: const Color(0xFFCEEE93)),
                ),
                const SizedBox(height: 14),
              ],

              // Submit Button
              ElevatedButton(
                onPressed: _saving ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFCEEE93),
                  foregroundColor: const Color(0xFF131F00),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF131F00)),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(PhosphorIconsRegular.paperPlaneRight, size: 20),
                          const SizedBox(width: 8),
                          Text('Submit to Coach', style: AppTheme.f(15, weight: FontWeight.w700)),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _metricField({
    required GymColors gc,
    required TextEditingController controller,
    required String label,
    required String unit,
    required IconData icon,
    required String hint,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTheme.f(12, weight: FontWeight.w600, color: gc.textSecondary)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          style: AppTheme.f(14, color: gc.text),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, size: 18, color: gc.textTertiary),
            suffixText: unit,
            suffixStyle: AppTheme.f(12, weight: FontWeight.w600, color: gc.textTertiary),
            hintText: hint,
            hintStyle: AppTheme.f(13, color: gc.textTertiary),
            filled: true,
            fillColor: gc.bgRaised,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: gc.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: gc.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: Color(0xFFCEEE93)),
            ),
          ),
        ),
      ],
    );
  }
}