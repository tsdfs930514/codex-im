const assert = require("assert");

const accessControl = require("../src/domain/access/access-control");
const {
  extractCardAction,
  normalizeFeishuTextEvent,
} = require("../src/presentation/message/normalizers");

const config = {
  defaultWorkspaceId: "default",
  allowedFeishuUserIds: ["ou_allowed"],
  groupMentionPrefix: "@Codex",
};

function textEvent({ text, senderId = "ou_allowed", chatType = "p2p" }) {
  return {
    sender: {
      sender_id: {
        open_id: senderId,
      },
    },
    message: {
      message_type: "text",
      chat_id: "oc_chat",
      chat_type: chatType,
      message_id: `om_${Math.random().toString(16).slice(2)}`,
      content: JSON.stringify({ text }),
    },
  };
}

function decide(event) {
  return accessControl.shouldHandleFeishuText(
    config,
    normalizeFeishuTextEvent(event, config)
  );
}

{
  const decision = decide(textEvent({ text: "帮我看一下这个项目" }));
  assert.equal(decision.allowed, true);
  assert.equal(decision.normalized.text, "帮我看一下这个项目");
}

{
  const decision = decide(textEvent({ text: "帮我看一下这个项目", senderId: "ou_other" }));
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "unauthorized_user");
}

{
  const decision = decide(textEvent({ text: "普通群聊闲聊", chatType: "group" }));
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "missing_group_mention");
}

{
  const decision = decide(textEvent({ text: "/codex where", chatType: "group" }));
  assert.equal(decision.allowed, true);
  assert.equal(decision.normalized.command, "where");
}

{
  const decision = decide(textEvent({ text: "@Codex 总结一下", chatType: "group" }));
  assert.equal(decision.allowed, true);
  assert.equal(decision.normalized.command, "message");
  assert.equal(decision.normalized.text, "总结一下");
  assert.equal(decision.normalized.originalText, "@Codex 总结一下");
}

{
  assert.equal(accessControl.isAllowedFeishuUser(config, "ou_allowed"), true);
  assert.equal(accessControl.isAllowedFeishuUser(config, "ou_other"), false);
}

{
  const action = extractCardAction({
    action: {
      value: { kind: "panel", action: "set_model" },
      selected_option: { value: "gpt-5.4" },
    },
  });
  assert.equal(action.selectedValue, "gpt-5.4");
}

{
  const action = extractCardAction({
    action: {
      value: { kind: "panel", action: "set_effort" },
      selected_value: "high",
    },
  });
  assert.equal(action.selectedValue, "high");
}

console.log("[codex-im] access-control tests passed");
