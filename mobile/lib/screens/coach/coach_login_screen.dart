import 'package:flutter/material.dart';
import 'package:phosphoricons_flutter/phosphoricons_flutter.dart';

import '../../services/coach/coach_state.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_theme.dart';

/// Login screen for CoachOS client integration.
///
/// Shown when the user taps "Connect to Coach" from settings.
/// After successful login, the app syncs data to the CoachOS web dashboard.
class CoachLoginScreen extends StatefulWidget {
  final bool isRoot;
  const CoachLoginScreen({super.key, this.isRoot = false});

  @override
  State<CoachLoginScreen> createState() => _CoachLoginScreenState();
}

class _CoachLoginScreenState extends State<CoachLoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  bool _isSignUp = false;
  bool _loading = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _emailCtrl.text.trim();
    final pass = _passCtrl.text.trim();
    final name = _nameCtrl.text.trim();

    if (email.isEmpty || pass.isEmpty) {
      setState(() => _error = 'Please fill in all fields');
      return;
    }
    if (_isSignUp && name.isEmpty) {
      setState(() => _error = 'Please enter your name');
      return;
    }
    if (pass.length < 6) {
      setState(() => _error = 'Password must be at least 6 characters');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    String? err;
    if (_isSignUp) {
      err = await CoachState.instance.signUp(
        email: email,
        password: pass,
        fullName: name,
      );
    } else {
      err = await CoachState.instance.signIn(
        email: email,
        password: pass,
      );
    }

    if (!mounted) return;

    if (err != null) {
      setState(() {
        _loading = false;
        _error = _friendlyError(err!);
      });
    } else {
      if (!widget.isRoot && Navigator.of(context).canPop()) {
        Navigator.of(context).pop(true);
      }
    }
  }

  String _friendlyError(String raw) {
    final lower = raw.toLowerCase();
    if (lower.contains('invalid login')) return 'Invalid email or password';
    if (lower.contains('already registered')) return 'Account already exists. Try signing in.';
    if (lower.contains('network') || lower.contains('socket')) {
      return 'No internet connection. Check your network.';
    }
    return raw.length > 100 ? '${raw.substring(0, 100)}...' : raw;
  }

  @override
  Widget build(BuildContext context) {
    final gc = context.gc;
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Scaffold(
      backgroundColor: gc.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(24, 20, 24, 20 + bottom),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Back button (if not root)
              if (!widget.isRoot) ...[
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
                const SizedBox(height: 28),
              ] else ...[
                const SizedBox(height: 20),
              ],

              // Header
              Icon(PhosphorIconsFill.personArmsSpread, size: 48, color: gc.accent),
              const SizedBox(height: 16),
              Text(
                widget.isRoot
                    ? (_isSignUp ? 'Create CoachOS Account' : 'Welcome to CoachOS')
                    : (_isSignUp ? 'Join CoachOS' : 'Connect to Coach'),
                style: AppTheme.d(28, color: gc.text),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                widget.isRoot
                    ? (_isSignUp
                        ? 'Create your athlete account to connect with your coach'
                        : 'Sign in to access your coaching portal & training plan')
                    : (_isSignUp
                        ? 'Create your account to connect with your coach'
                        : 'Sign in to sync your progress with your coach'),
                style: AppTheme.s(14, color: gc.textSecondary),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 40),

              // Name field (sign up only)
              if (_isSignUp) ...[
                _label('Full Name', gc),
                const SizedBox(height: 8),
                _input(
                  controller: _nameCtrl,
                  hint: 'Your name',
                  icon: PhosphorIconsRegular.user,
                  gc: gc,
                ),
                const SizedBox(height: 20),
              ],

              // Email field
              _label('Email', gc),
              const SizedBox(height: 8),
              _input(
                controller: _emailCtrl,
                hint: 'you@example.com',
                icon: PhosphorIconsRegular.envelopeSimple,
                gc: gc,
                keyboardType: TextInputType.emailAddress,
              ),

              const SizedBox(height: 20),

              // Password field
              _label('Password', gc),
              const SizedBox(height: 8),
              _input(
                controller: _passCtrl,
                hint: 'Min. 6 characters',
                icon: PhosphorIconsRegular.lock,
                gc: gc,
                obscure: _obscure,
                suffix: GestureDetector(
                  onTap: () => setState(() => _obscure = !_obscure),
                  child: Icon(
                    _obscure ? PhosphorIconsRegular.eye : PhosphorIconsRegular.eyeSlash,
                    size: 20,
                    color: gc.textTertiary,
                  ),
                ),
              ),

              // Error
              if (_error != null) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: gc.danger.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: gc.danger.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      Icon(PhosphorIconsFill.warning, size: 18, color: gc.danger),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _error!,
                          style: AppTheme.s(13, color: gc.danger),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 28),

              // Submit button
              GestureDetector(
                onTap: _loading ? null : _submit,
                child: Container(
                  height: 52,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [gc.accent, gc.brass],
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: gc.accent.withValues(alpha: 0.3),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Center(
                    child: _loading
                        ? SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: gc.onEmber,
                            ),
                          )
                        : Text(
                            _isSignUp ? 'Create Account' : 'Sign In',
                            style: AppTheme.f(16, color: gc.onEmber),
                          ),
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Toggle sign up / sign in
              GestureDetector(
                onTap: () => setState(() {
                  _isSignUp = !_isSignUp;
                  _error = null;
                }),
                child: RichText(
                  textAlign: TextAlign.center,
                  text: TextSpan(
                    style: AppTheme.s(14, color: gc.textSecondary),
                    children: [
                      TextSpan(
                        text: _isSignUp ? 'Already have an account? ' : "Don't have an account? ",
                      ),
                      TextSpan(
                        text: _isSignUp ? 'Sign In' : 'Sign Up',
                        style: AppTheme.s(14, weight: FontWeight.w700, color: gc.accent),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _label(String text, GymColors gc) => Text(
        text,
        style: AppTheme.s(13, weight: FontWeight.w600, color: gc.textSecondary, letterSpacing: 0.5),
      );

  Widget _input({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    required GymColors gc,
    TextInputType? keyboardType,
    bool obscure = false,
    Widget? suffix,
  }) =>
      Container(
        decoration: BoxDecoration(
          color: gc.bgRaised,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: gc.border),
        ),
        child: TextField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscure,
          style: AppTheme.s(15, color: gc.text),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: AppTheme.s(15, color: gc.textTertiary),
            prefixIcon: Icon(icon, size: 20, color: gc.textTertiary),
            suffixIcon: suffix,
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      );
}
