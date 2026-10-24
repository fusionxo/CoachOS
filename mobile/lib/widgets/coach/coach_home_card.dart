import 'package:flutter/material.dart';
import 'package:phosphoricons_flutter/phosphoricons_flutter.dart';

import '../../screens/coach/coach_chat_screen.dart';
import '../../screens/coach/daily_checkin_screen.dart';
import '../../services/coach/coach_state.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_theme.dart';
import '../ui_kit.dart';

/// Home screen dashboard card for athletes connected to a coach via CoachOS.
/// Provides instant access to Daily Check-ins, Coach Messaging, and Program Sync.
class CoachHomeCard extends StatefulWidget {
  const CoachHomeCard({super.key});

  @override
  State<CoachHomeCard> createState() => _CoachHomeCardState();
}

class _CoachHomeCardState extends State<CoachHomeCard> {
  bool _syncing = false;

  Future<void> _triggerSync() async {
    if (_syncing) return;
    setState(() => _syncing = true);
    final count = await CoachState.instance.flushSyncs();
    await CoachState.instance.syncAssignedPrograms();
    if (mounted) {
      setState(() => _syncing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            count > 0 ? 'Synced $count updates with your coach!' : 'Programs and stats up to date!',
          ),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final gc = context.gc;

    return ListenableBuilder(
      listenable: CoachState.instance,
      builder: (context, _) {
        final state = CoachState.instance;
        if (!state.isClient) return const SizedBox.shrink();

        final coachName = state.coachName ?? 'Your Coach';
        final pending = state.pendingCount;

        return SoftCard(
          padding: const EdgeInsets.all(16),
          color: gc.bgRaised,
          borderColor: const Color(0xFF3B561B),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Row
              Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCEEE93).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFCEEE93).withValues(alpha: 0.3)),
                    ),
                    child: const Icon(
                      PhosphorIconsRegular.shieldCheck,
                      color: Color(0xFFCEEE93),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              coachName,
                              style: AppTheme.f(15, weight: FontWeight.w700, color: gc.text),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFCEEE93).withValues(alpha: 0.18),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                'COACH',
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFFCEEE93),
                                  letterSpacing: 0.8,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          pending > 0
                              ? '$pending offline update${pending > 1 ? 's' : ''} pending sync'
                              : 'Connected & in sync',
                          style: AppTheme.f(
                            12,
                            weight: FontWeight.w400,
                            color: pending > 0 ? gc.warn : gc.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: _syncing
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Color(0xFFCEEE93),
                            ),
                          )
                        : Icon(PhosphorIconsRegular.arrowsClockwise, size: 20, color: gc.textSecondary),
                    onPressed: _syncing ? null : _triggerSync,
                    tooltip: 'Sync with Coach',
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Action Buttons Row
              Row(
                children: [
                  // Daily Check-in Button
                  Expanded(
                    child: InkWell(
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const DailyCheckInScreen()),
                        );
                      },
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFCEEE93),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              PhosphorIconsRegular.checkSquareOffset,
                              size: 16,
                              color: Color(0xFF09090B),
                            ),
                            SizedBox(width: 6),
                            Text(
                              'Daily Check-in',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF09090B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),

                  // Coach Chat Button
                  Expanded(
                    child: InkWell(
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const CoachChatScreen()),
                        );
                      },
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                        decoration: BoxDecoration(
                          color: gc.mutedFill,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: gc.border),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              PhosphorIconsRegular.chatsCircle,
                              size: 16,
                              color: gc.text,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Chat',
                              style: AppTheme.f(
                                13,
                                weight: FontWeight.w700,
                                color: gc.text,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
