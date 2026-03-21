import { Agent } from '@openserv-labs/sdk';

/**
 * Patches Agent.respondToChat to fix field name mismatch between
 * the SDK (expects msg.author/msg.message) and the platform API
 * (sends msg.role/msg.content).
 */
export function patchAgent(agent: Agent): void {
  const originalRespondToChat = (agent as any).respondToChat.bind(agent);

  (agent as any).respondToChat = async function (action: any) {
    // Fix message field names before the SDK processes them
    if (action.messages) {
      for (const msg of action.messages) {
        if (!msg.author && msg.role) {
          msg.author = msg.role;
        }
        if (!msg.message && msg.content) {
          msg.message = msg.content;
        }
      }
    }
    return originalRespondToChat(action);
  };
}
