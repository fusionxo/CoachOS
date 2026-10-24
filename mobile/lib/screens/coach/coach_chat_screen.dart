import 'dart:async';
import 'package:flutter/material.dart';
import 'package:phosphoricons_flutter/phosphoricons_flutter.dart';

import '../../services/coach/coach_state.dart';
import '../../services/coach/coach_supabase.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_theme.dart';

/// Real-time chat screen between athlete and coach.
class CoachChatScreen extends StatefulWidget {
  const CoachChatScreen({super.key});

  @override
  State<CoachChatScreen> createState() => _CoachChatScreenState();
}

class _CoachChatScreenState extends State<CoachChatScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  bool _sending = false;
  StreamSubscription<List<Map<String, dynamic>>>? _messageSub;

  @override
  void initState() {
    super.initState();
    _initRealtimeChat();
  }

  void _initRealtimeChat() {
    final clientId = CoachState.instance.clientId;
    if (clientId == null) {
      setState(() => _loading = false);
      return;
    }
    _loadMessages();
    _messageSub = CoachSupabase.instance.getMessagesStream(clientId).listen((list) {
      if (!mounted) return;
      setState(() {
        _messages = list;
        _loading = false;
      });
      _scrollToBottom();
    }, onError: (_) {
      _loadMessages(silent: true);
    });
  }

  @override
  void dispose() {
    _messageSub?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadMessages({bool silent = false}) async {
    final clientId = CoachState.instance.clientId;
    if (clientId == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }

    try {
      final list = await CoachSupabase.instance.getMessages(clientId);
      if (mounted) {
        setState(() {
          _messages = list;
          _loading = false;
        });
        if (!silent) {
          _scrollToBottom();
        }
      }
    } catch (e) {
      if (!silent && mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _sending) return;

    final clientId = CoachState.instance.clientId;
    if (clientId == null) return;

    setState(() => _sending = true);
    _messageController.clear();

    try {
      await CoachSupabase.instance.sendMessage(
        clientId: clientId,
        content: text,
      );
      await _loadMessages(silent: true);
      _scrollToBottom();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to send: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final gc = context.gc;
    final coachName = CoachState.instance.coachName ?? 'Coach';
    final uid = CoachSupabase.instance.userId;

    return Scaffold(
      backgroundColor: gc.bg,
      appBar: AppBar(
        backgroundColor: gc.bgRaised,
        elevation: 0,
        leading: IconButton(
          icon: Icon(PhosphorIconsRegular.caretLeft, color: gc.text),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: const Color(0xFFCEEE93).withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(PhosphorIconsRegular.user, size: 18, color: Color(0xFFCEEE93)),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(coachName, style: AppTheme.f(15, weight: FontWeight.w700, color: gc.text)),
                Text('CoachOS Direct Chat', style: AppTheme.f(10, color: const Color(0xFFCEEE93))),
              ],
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Messages area
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFCEEE93)),
                    )
                  : _messages.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(PhosphorIconsRegular.chatCircleDots, size: 48, color: gc.textTertiary),
                              const SizedBox(height: 12),
                              Text('No messages yet', style: AppTheme.f(14, weight: FontWeight.w600, color: gc.textSecondary)),
                              const SizedBox(height: 4),
                              Text('Send a message to start communicating with $coachName',
                                  style: AppTheme.f(12, color: gc.textTertiary)),
                            ],
                          ),
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          itemCount: _messages.length,
                          itemBuilder: (context, index) {
                            final m = _messages[index];
                            final isMe = m['sender_id'] == uid;
                            final content = m['content'] as String? ?? '';
                            final createdAt = DateTime.tryParse(m['created_at'] as String? ?? '');

                            return Align(
                              alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                constraints: BoxConstraints(
                                  maxWidth: MediaQuery.of(context).size.width * 0.76,
                                ),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: isMe ? const Color(0xFF2C3E14) : gc.bgRaised,
                                  border: Border.all(
                                    color: isMe ? const Color(0xFF4A6822) : gc.border,
                                  ),
                                  borderRadius: BorderRadius.only(
                                    topLeft: const Radius.circular(16),
                                    topRight: const Radius.circular(16),
                                    bottomLeft: Radius.circular(isMe ? 16 : 4),
                                    bottomRight: Radius.circular(isMe ? 4 : 16),
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      content,
                                      style: AppTheme.f(14, color: isMe ? const Color(0xFFE3EED2) : gc.text),
                                    ),
                                    if (createdAt != null) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        '${createdAt.toLocal().hour.toString().padLeft(2, '0')}:${createdAt.toLocal().minute.toString().padLeft(2, '0')}',
                                        style: AppTheme.f(10, color: isMe ? const Color(0xFFA6BA91) : gc.textTertiary),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
            ),

            // Input Bar
            Container(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
              decoration: BoxDecoration(
                color: gc.bgRaised,
                border: Border(top: BorderSide(color: gc.border)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      style: AppTheme.f(14, color: gc.text),
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
                      decoration: InputDecoration(
                        hintText: 'Message $coachName...',
                        hintStyle: AppTheme.f(13, color: gc.textTertiary),
                        filled: true,
                        fillColor: gc.bg,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: BorderSide(color: gc.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: BorderSide(color: gc.border),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(20),
                          borderSide: const BorderSide(color: Color(0xFFCEEE93)),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: const BoxDecoration(
                      color: Color(0xFFCEEE93),
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: _sending
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF131F00)),
                            )
                          : const Icon(PhosphorIconsRegular.paperPlaneRight, color: Color(0xFF131F00), size: 18),
                      onPressed: _sending ? null : _sendMessage,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}