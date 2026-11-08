import assert from 'assert';
import mongoose from 'mongoose';
import { aiService, devConversations, devChatMessages } from './src/services/aiService.js';
import { CHAT_ROLES } from './src/models/ChatMessage.js';

console.log('\n--- MAILFLOW PHASE 4: AI ASSISTANT & CHAT ENGINE TESTS ---\n');

async function runPhase4Tests() {
  const workspace1Id = new mongoose.Types.ObjectId().toString();
  const workspace2Id = new mongoose.Types.ObjectId().toString();
  const user1Id = new mongoose.Types.ObjectId().toString();
  const user2Id = new mongoose.Types.ObjectId().toString();

  // [Test 1] Create and List Conversations
  console.log('[Test 1] Conversation Creation & Workspace Listing');
  const conv1 = await aiService.createConversation({
    workspaceId: workspace1Id,
    userId: user1Id,
    title: 'Product Announcement Campaign',
  });

  assert.ok(conv1._id, 'Conversation must have generated ID');
  assert.strictEqual(conv1.title, 'Product Announcement Campaign');

  const user1Convs = await aiService.listConversations({
    workspaceId: workspace1Id,
    userId: user1Id,
  });
  assert.strictEqual(user1Convs.length, 1, 'User 1 must have 1 conversation');
  console.log('✓ Conversation created and listed for user');

  // [Test 2] Cross-User and Multi-Tenant Isolation
  console.log('\n[Test 2] Chat History Multi-Tenant Isolation');
  const user2Convs = await aiService.listConversations({
    workspaceId: workspace1Id,
    userId: user2Id,
  });
  assert.strictEqual(user2Convs.length, 0, 'User 2 must not see User 1 conversations');

  await assert.rejects(
    async () => {
      await aiService.getConversationMessages({
        workspaceId: workspace1Id,
        userId: user2Id, // Foreign user
        conversationId: conv1._id,
      });
    },
    /Conversation not found or access denied/,
    'User 2 was incorrectly able to access User 1 conversation'
  );

  await assert.rejects(
    async () => {
      await aiService.getConversationMessages({
        workspaceId: workspace2Id, // Foreign workspace
        userId: user1Id,
        conversationId: conv1._id,
      });
    },
    /Conversation not found or access denied/,
    'Conversation was incorrectly accessible from foreign workspace'
  );
  console.log('✓ Multi-tenant and user conversation boundaries strictly enforced (IDOR protected)');

  // [Test 3] Send Message & Generate AI Assistant Reply
  console.log('\n[Test 3] Interactive AI Message Exchange');
  const chatResult = await aiService.sendMessage({
    workspaceId: workspace1Id,
    userId: user1Id,
    conversationId: conv1._id,
    prompt: 'Please draft 5 subject lines for our new winter sale.',
    actionType: 'subject_lines',
  });

  assert.ok(chatResult.userMessage, 'User message must be returned');
  assert.strictEqual(chatResult.userMessage.role, CHAT_ROLES.USER);
  assert.ok(chatResult.assistantMessage, 'Assistant message must be returned');
  assert.strictEqual(chatResult.assistantMessage.role, CHAT_ROLES.ASSISTANT);
  assert.ok(
    chatResult.assistantMessage.content.length > 50,
    'Assistant message content must be comprehensive'
  );

  const historyAfter = await aiService.getConversationMessages({
    workspaceId: workspace1Id,
    userId: user1Id,
    conversationId: conv1._id,
  });
  assert.strictEqual(historyAfter.messages.length, 2, 'Conversation must now have 2 messages');
  console.log('✓ AI message generation and chat history persistence verified');

  // [Test 4] Direct Email Drafting Quick-Action
  console.log('\n[Test 4] Email Copy Generation Quick-Action');
  const emailDraft = await aiService.generateCompletion({
    prompt: 'Write an email introducing our new automation features to Acme Corp',
    actionType: 'draft_email',
  });

  assert.ok(emailDraft.includes('{{firstName}}'), 'Generated email should include {{firstName}} placeholder');
  assert.ok(emailDraft.includes('Subject Line'), 'Generated email should include a Subject Line');
  assert.ok(emailDraft.includes('{{company}}'), 'Generated email should include {{company}} placeholder');
  console.log('✓ Email draft generation produces structured copy with personalizable placeholders');

  // [Test 5] Conversation Deletion
  console.log('\n[Test 5] Conversation Deletion & Cleanup');
  const deleteRes = await aiService.deleteConversation({
    workspaceId: workspace1Id,
    userId: user1Id,
    conversationId: conv1._id,
  });
  assert.strictEqual(deleteRes.success, true);

  const finalConvs = await aiService.listConversations({
    workspaceId: workspace1Id,
    userId: user1Id,
  });
  assert.strictEqual(finalConvs.length, 0, 'Conversation list should be empty after deletion');
  console.log('✓ Conversation and associated chat messages removed cleanly');

  console.log('\n======================================================');
  console.log('✓ ALL PHASE 4 AI ASSISTANT TESTS PASSED!');
  console.log('======================================================\n');
  process.exit(0);
}

runPhase4Tests().catch((err) => {
  console.error('Phase 4 test failed:', err);
  process.exit(1);
});

