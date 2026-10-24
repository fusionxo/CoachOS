import 'package:flutter/material.dart';
import 'package:phosphoricons_flutter/phosphoricons_flutter.dart';

import '../../screens/coach/coach_invite_screen.dart';
import '../../screens/coach/coach_login_screen.dart';
import '../../screens/coach/daily_checkin_screen.dart';
import '../../screens/coach/coach_chat_screen.dart';
import '../../services/coach/coach_state.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_theme.dart';
import '../ui_kit.dart';

/// Settings card for CoachOS integration.
/// Displays connection status, coach details, sync trigger, and check-in launcher.
class CoachSettingsCard extends StatefulWidget {
  const CoachSettingsCard({super.key});

  @override
  State<CoachSettingsCard> createState() => _CoachSettingsCardState();
}

class _CoachSettingsCardState extends State<CoachSettingsCard> {
  @override
  Widget build(BuildContext context) {
    final gc = context.gc;

    return ListenableBuilder(
      listenable: CoachState.instance,
      builder: (context, _) {
        final state = CoachState.instance;

        if (state.isClient) {
          return _buildClientConnectedCard(context, gc, state);
        } else {
          return _buildSoloCard(context, gc);
        }
      },
    );
  }

  Widget _buildClientConnectedCard(BuildContext context, GymColors gc, CoachState state) {
    final coachName = state.coachName ?? 'Your Coach';
    final coachEmail = state.coachEmail ?? '';
    final pendingCount = state.pendingCount;

    return SoftCard(
      padding: const EdgeInsets.all(18),
      borderColor: const Color(0xFF3B561B),
      color: gc.bgRaised,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFCEEE93).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  PhosphorIconsRegular.checkCircle,
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
                          'CoachOS Connected',
                          style: AppTheme.f(14, weight: FontWeight.w700, color: gc.text),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFCEEE93).withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            'ACTIVE',
                            style: AppTheme.f(9, weight: FontWeight.w800, color: const Color(0xFFCEEE93)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$coachName ${coachEmail.isNotEmpty ? '($coachEmail)' : ''}',
                      style: AppTheme.f(12, color: gc.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Sync status
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: gc.bg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: gc.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(
                      state.isSyncing
                          ? PhosphorIconsRegular.arrowsClockwise
                          : (pendingCount > 0 ? PhosphorIconsRegular.cloudArrowUp : PhosphorIconsRegular.cloudCheck),
                      size: 16,
                      color: pendingCount > 0 ? const Color(0xFFE8B84B) : const Color(0xFFCEEE93),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      state.isSyncing
                          ? 'Syncing with CoachOS...'
                          : (pendingCount > 0 ? '$pendingCount offline changes queued' : 'Up to date'),
                      style: AppTheme.f(12, weight: FontWeight.w500, color: gc.textSecondary),
                    ),
                  ],
                ),
                GestureDetector(
                  onTap: state.isSyncing ? null : () => state.flushSyncs(),
                  child: Text(
                    'Sync Now',
                    style: AppTheme.f(12, weight: FontWeight.w700, color: const Color(0xFFCEEE93)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Actions
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const DailyCheckInScreen()),
                    );
                  },
                  icon: const Icon(PhosphorIconsRegular.notepad, size: 16),
                  label: Text('Daily Check-in', style: AppTheme.f(13, weight: FontWeight.w700)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFCEEE93),
                    foregroundColor: const Color(0xFF131F00),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              OutlinedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CoachChatScreen()),
                  );
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFCEEE93),
                  side: const BorderSide(color: Color(0xFF4A6822)),
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Icon(PhosphorIconsRegular.chatCircleDots, size: 18),
              ),
              const SizedBox(width: 10),
              OutlinedButton(
                onPressed: () => _confirmSignOut(context),
                style: OutlinedButton.styleFrom(
                  foregroundColor: gc.textSecondary,
                  side: BorderSide(color: gc.border),
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Icon(PhosphorIconsRegular.signOut, size: 18),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSoloCard(BuildContext context, GymColors gc) {
    return SoftCard(
      padding: const EdgeInsets.all(18),
      borderColor: gc.border,
      color: gc.bgRaised,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFCEEE93).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  PhosphorIconsRegular.usersThree,
                  color: Color(0xFFCEEE93),
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'CoachOS Integration',
                      style: AppTheme.f(14, weight: FontWeight.w700, color: gc.text),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Connect with your personal trainer or coach',
                      style: AppTheme.f(11, color: gc.textTertiary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Sync workouts, log daily check-ins (weight, sleep, steps), and receive customized workout routines straight from your coach.',
            style: AppTheme.f(12, color: gc.textSecondary),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const CoachInviteScreen()),
                    );
                  },
                  icon: const Icon(PhosphorIconsRegular.ticket, size: 16),
                  label: Text('Enter Invite Code', style: AppTheme.f(13, weight: FontWeight.w700)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFCEEE93),
                    foregroundColor: const Color(0xFF131F00),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              OutlinedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CoachLoginScreen()),
                  );
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: gc.text,
                  side: BorderSide(color: gc.border),
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('Sign In', style: AppTheme.f(13, weight: FontWeight.w600)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _confirmSignOut(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.gc.bgRaised,
        title: Text('Disconnect from Coach?', style: AppTheme.f(16, weight: FontWeight.w700)),
        content: Text(
          'Your local workout data will stay safely in GymMane, but workouts will no longer sync to your coach.',
          style: AppTheme.f(13, color: context.gc.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text('Cancel', style: AppTheme.f(13, color: context.gc.textSecondary)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              await CoachState.instance.signOut();
            },
            child: Text('Disconnect', style: AppTheme.f(13, color: Colors.redAccent)),
          ),
        ],
      ),
    );
  }
}