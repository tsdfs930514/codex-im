const messageNormalizers = require("../presentation/message/normalizers");
const accessControl = require("../domain/access/access-control");
const eventsRuntime = require("./codex-event-service");
const { formatFailureText } = require("../shared/error-text");

async function onFeishuTextEvent(runtime, event) {
  const rawNormalized = messageNormalizers.normalizeFeishuTextEvent(event, runtime.config);
  if (!rawNormalized) {
    return;
  }
  const accessDecision = accessControl.shouldHandleFeishuText(runtime.config, rawNormalized);
  if (!accessDecision.allowed) {
    console.log(
      `[codex-im] ignored Feishu message reason=${accessDecision.reason} sender=${rawNormalized.senderId || "-"} chat=${rawNormalized.chatId || "-"}`
    );
    return;
  }
  const normalized = accessDecision.normalized || rawNormalized;

  if (await runtime.dispatchTextCommand(normalized)) {
    return;
  }

  const workspaceContext = await runtime.resolveWorkspaceContext(normalized, {
    replyToMessageId: normalized.messageId,
    missingWorkspaceText: "当前会话还未绑定项目。先发送 `/codex bind /绝对路径`。",
  });
  if (!workspaceContext) {
    return;
  }
  const { bindingKey, workspaceRoot } = workspaceContext;
  const { threadId } = await runtime.resolveWorkspaceThreadState({
    bindingKey,
    workspaceRoot,
    normalized,
    autoSelectThread: true,
  });

  runtime.setPendingBindingContext(bindingKey, normalized);
  if (threadId) {
    runtime.setPendingThreadContext(threadId, normalized);
  }

  await runtime.addPendingReaction(bindingKey, normalized.messageId);

  try {
    const resolvedThreadId = await runtime.ensureThreadAndSendMessage({
      bindingKey,
      workspaceRoot,
      normalized,
      threadId,
    });
    runtime.movePendingReactionToThread(bindingKey, resolvedThreadId);
  } catch (error) {
    await runtime.clearPendingReactionForBinding(bindingKey);
    await runtime.sendInfoCardMessage({
      chatId: normalized.chatId,
      replyToMessageId: normalized.messageId,
      text: formatFailureText("处理失败", error),
    });
    throw error;
  }
}

async function onFeishuCardAction(runtime, data) {
  try {
    const context = messageNormalizers.normalizeCardActionContext(data, runtime.config);
    if (!context || !accessControl.isAllowedFeishuUser(runtime.config, context.senderId)) {
      console.log(
        `[codex-im] ignored Feishu card action reason=unauthorized_user sender=${context?.senderId || "-"}`
      );
      return runtime.buildCardToast("无权操作此 Codex 机器人。");
    }
    return await runtime.handleCardAction(data);
  } catch (error) {
    console.error(`[codex-im] failed to process card action: ${error.message}`);
    return runtime.buildCardToast(formatFailureText("处理失败", error));
  }
}

function onCodexMessage(runtime, message) {
  eventsRuntime.handleCodexMessage(runtime, message);
}

module.exports = {
  onCodexMessage,
  onFeishuCardAction,
  onFeishuTextEvent,
};
