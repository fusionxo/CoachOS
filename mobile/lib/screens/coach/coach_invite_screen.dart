import 'package:flutter/material.dart';
import 'package:phosphoricons_flutter/phosphoricons_flutter.dart';

import '../../services/coach/coach_state.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_theme.dart';

/// Screen for accepting a coach invitation via token/link.
///
/// After the client signs in, they paste or scan the invite token
/// from their coach to link their accounts.
class CoachInviteScreen extends StatefulWidget {
  const CoachInviteScreen({super.key});

  @override
  State<CoachInviteScreen> createState() => _CoachInviteScreenState();
}

class _CoachInviteScreenState extends State<CoachInviteScreen> {
  final _tokenCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _success = false;

  @override
  void dispose() {
    _tokenCtrl.dispose();
    super.dispose();
  }

  Future<void> _accept() async {
    final token = _tokenCtrl.text.trim();
    if (token.isEmpty) {
      setState(() => _error = 'Please enter your invite code');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    final err = await CoachState.instance.acceptInvite(token);

    if (!mounted) return;

    if (err != null) {
      setState(() {
        _loading = false;
        _error = err;
      });
    } else {
      setState(() {
        _loading = false;
        _success = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final gc = context.gc;
    final coach = CoachState.instance;

    return Scaffold(
      backgroundColor: gc.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: _success ? _buildSuccess(gc, coach) : _buildForm(gc),
        ),
      ),
    );
  }

  Widget _buildSuccess(GymColors gc, CoachState coach) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: gc.sage.withValues(alpha: 0.15),
            shape: BoxShape.circle,
          ),
          child: Icon(PhosphorIconsFill.checkCircle, size: 44, color: gc.sage),
        ),
        const SizedBox(height: 24),
        Text('Connected!', style: AppTheme.d(28, color: gc.text)),
        const SizedBox(height: 8),
        if (coach.coachName != null)
          Text(
            'You are now linked to ${coach.coachName}',
            style: AppTheme.s(15, color: gc.textSecondary),
            textAlign: TextAlign.center,
          ),
        const SizedBox(height: 12),
        Text(
          'Your workouts, check-ins, and progress will sync to your coach\'s dashboard.',
          style: AppTheme.s(14, color: gc.textTertiary),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 40),
        GestureDetector(
          onTap: () => Navigator.of(context).popUntil((r) => r.isFirst),
          child: Container(
            height: 52,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [gc.accent, gc.brass]),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(
              child: Text('Start Training', style: AppTheme.f(16, color: gc.onEmber)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildForm(GymColors gc) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Back button
        Align(
          alignment: Alignment.centerLeft,
          child: GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: gc.bgRaised,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: gc.border),
              ),
              child: Icon(PhosphorIconsRegular.arrowLeft, size: 20, color: gc.text),
            ),
          ),
        ),

        const Spacer(),

        // Header
        Icon(PhosphorIconsFill.linkSimple, size: 48, color: gc.accent),
        const SizedBox(height: 16),
        Text(
          'Enter Invite Code',
          style: AppTheme.d(28, color: gc.text),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Your coach sent you an invite code.\nPaste it below to connect.',
          style: AppTheme.s(14, color: gc.textSecondary),
          textAlign: TextAlign.center,
        ),

        const SizedBox(height: 32),

        // Token input
        Container(
          decoration: BoxDecoration(
            color: gc.bgRaised,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: gc.border),
          ),
          child: TextField(
            controller: _tokenCtrl,
            style: AppTheme.s(15, color: gc.text, letterSpacing: 1),
            textAlign: TextAlign.center,
            decoration: InputDecoration(
              hintText: 'Paste invite code here',
              hintStyle: AppTheme.s(15, color: gc.textTertiary),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            ),
          ),
        ),

        // Error
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: AppTheme.s(13, color: gc.danger), textAlign: TextAlign.center),
        ],

        const SizedBox(height: 24),

        // Accept button
        GestureDetector(
          onTap: _loading ? null : _accept,
          child: Container(
            height: 52,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [gc.accent, gc.brass]),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(color: gc.accent.withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 6)),
              ],
            ),
            child: Center(
              child: _loading
                  ? SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: gc.onEmber),
                    )
                  : Text('Connect to Coach', style: AppTheme.f(16, color: gc.onEmber)),
            ),
          ),
        ),

        const Spacer(flex: 2),
      ],
    );
  }
}
