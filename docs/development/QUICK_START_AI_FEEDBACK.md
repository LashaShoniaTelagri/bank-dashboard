# Quick Start: AI Feedback System

**Goal**: Get feedback tracking live in 30 minutes

## Step 1: Apply Database Migration (5 min)

```bash
# Apply the feedback tracking migration
cd /Users/lasha/Desktop/TelAgri/tech/gitlab/new-system/telagri-bank-dashboard
supabase db push
```

This creates:
- ✅ Feedback columns in `ai_chat_messages` 
- ✅ `ai_feedback_analytics` table for detailed tracking
- ✅ `ai_quality_metrics` materialized view for dashboards
- ✅ `record_ai_feedback()` function for easy recording

## Step 2: Update ChatBubble Interface (5 min)

Add message ID to track feedback properly:

```typescript
// src/components/AgriCopilot.tsx (line ~58)
type ChatBubble = { 
  role: "user" | "assistant"; 
  content: string; 
  timestamp?: Date;
  id?: string; // ADD THIS - message ID from database
};
```

## Step 3: Store Message IDs (10 min)

Update the `sendMessage` function to capture and store message IDs:

```typescript
// After inserting messages (line ~494)
const { data: insertedMessages, error: insertError } = await supabase
  .from('ai_chat_messages')
  .insert([
    {
      session_id: sessionId,
      sender_role: 'specialist',
      content: userMessage
    },
    {
      session_id: sessionId,
      sender_role: 'assistant',
      content: assistantMessage
    }
  ])
  .select('id, role, content, created_at');

if (!insertError && insertedMessages) {
  // Add messages with IDs to chat history
  setChatHistory(prev => [
    ...prev,
    { 
      role: 'user', 
      content: userMessage, 
      timestamp: new Date(),
      id: insertedMessages[0].id 
    },
    { 
      role: 'assistant', 
      content: assistantMessage, 
      timestamp: new Date(),
      id: insertedMessages[1].id 
    }
  ]);
}
```

## Step 4: Test Feedback (5 min)

1. Start development: `npm run dev`
2. Open AgriCopilot
3. Send a test query
4. Click 👍 or 👎
5. Check database: 
   ```sql
   SELECT * FROM ai_feedback_analytics ORDER BY created_at DESC LIMIT 5;
   ```

## Step 5: View Analytics (5 min)

```sql
-- Satisfaction rate this week
SELECT 
  query_type,
  satisfaction_rate,
  total_responses
FROM ai_quality_metrics
WHERE date >= NOW() - INTERVAL '7 days'
ORDER BY total_responses DESC;

-- Recent feedback
SELECT 
  rating,
  response_text,
  feedback_comment,
  created_at
FROM ai_feedback_analytics
ORDER BY created_at DESC
LIMIT 10;
```

---

## Next Steps (Optional)

### Immediate (Today)
- [ ] Review first 10 feedback entries
- [ ] Identify any patterns in dislikes

### This Week
- [ ] Sign up for [Helicone](https://helicone.ai) (free tier)
  - Add API key to `.env`
  - Update OpenAI endpoint (5 min change)
  - Start tracking costs automatically

### This Month
- [ ] Build Supabase dashboard for metrics
- [ ] Set up weekly review process
- [ ] Implement prompt improvements based on feedback

### Quarter
- [ ] Consider RAG implementation
- [ ] Evaluate fine-tuning if >500 interactions
- [ ] Integrate with bank reporting systems

---

## Quick Reference

**Record feedback programmatically:**
```typescript
await supabase.rpc('record_ai_feedback', {
  p_message_id: 'uuid-here',
  p_rating: 'like',
  p_feedback_comment: 'Very helpful!',
  p_feedback_tags: ['accurate', 'clear']
});
```

**Get satisfaction rate:**
```sql
SELECT 
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE feedback_rating = 'like') / 
    NULLIF(COUNT(*) FILTER (WHERE feedback_rating IN ('like', 'dislike')), 0), 
    2
  ) as satisfaction_rate
FROM ai_chat_messages
WHERE created_at >= NOW() - INTERVAL '7 days';
```

**Refresh metrics view:**
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY ai_quality_metrics;
```

---

## Troubleshooting

**Issue**: Feedback not recording
- Check message has `id` field
- Verify RPC function exists: `SELECT * FROM pg_proc WHERE proname = 'record_ai_feedback'`
- Check browser console for errors

**Issue**: Metrics not updating
- Run: `SELECT refresh_ai_quality_metrics();`
- Check last refresh: `SELECT * FROM pg_stat_user_tables WHERE relname = 'ai_quality_metrics'`

**Issue**: Performance slow
- Add indexes if needed
- Consider partitioning `ai_feedback_analytics` by date

---

**Questions?** Check the [full documentation](./AI_FEEDBACK_QUALITY_SYSTEM.md)

