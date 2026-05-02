function isAllowedFeishuUser(config, senderId) {
  const allowedUserIds = Array.isArray(config?.allowedFeishuUserIds)
    ? config.allowedFeishuUserIds
    : [];
  const normalizedSenderId = normalizeIdentifier(senderId);
  if (!allowedUserIds.length || !normalizedSenderId) {
    return false;
  }
  return allowedUserIds.some((allowedUserId) => normalizeIdentifier(allowedUserId) === normalizedSenderId);
}

function shouldHandleFeishuText(config, normalized) {
  if (!normalized) {
    return { allowed: false, reason: "missing_event" };
  }
  if (!isAllowedFeishuUser(config, normalized.senderId)) {
    return { allowed: false, reason: "unauthorized_user" };
  }
  if (!isGroupChat(normalized.chatType)) {
    return { allowed: true, normalized };
  }
  if (normalized.command && normalized.command !== "message") {
    return { allowed: true, normalized };
  }

  const mentionPrefix = normalizePrefix(config?.groupMentionPrefix);
  if (!mentionPrefix) {
    return { allowed: false, reason: "missing_group_mention_prefix" };
  }

  const strippedText = stripPrefix(normalized.text, mentionPrefix);
  if (!strippedText) {
    return { allowed: false, reason: "missing_group_mention" };
  }

  return {
    allowed: true,
    normalized: {
      ...normalized,
      originalText: normalized.originalText || normalized.text,
      text: strippedText,
      command: "message",
      groupTrigger: "mention_prefix",
    },
  };
}

function isGroupChat(chatType) {
  const normalized = normalizeIdentifier(chatType).toLowerCase();
  return normalized === "group" || normalized === "chat";
}

function normalizeIdentifier(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePrefix(value) {
  return normalizeIdentifier(value);
}

function stripPrefix(text, prefix) {
  const input = String(text || "").trim();
  const normalizedPrefix = String(prefix || "").trim();
  if (!input || !normalizedPrefix) {
    return "";
  }
  if (!input.toLowerCase().startsWith(normalizedPrefix.toLowerCase())) {
    return "";
  }
  return input.slice(normalizedPrefix.length).trim();
}

module.exports = {
  isAllowedFeishuUser,
  shouldHandleFeishuText,
};
