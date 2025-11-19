# AI Feedback & Quality Improvement System
## Continuous Learning for Agricultural Co-Pilot

**Strategic Goal**: Build a feedback loop that continuously improves AI response quality for better farmer outcomes and banking confidence.

---

## 🎯 Business Impact

| Metric | Impact |
|--------|---------|
| **Response Quality** | Higher specialist satisfaction → Faster F-100 reviews |
| **Farmer Outcomes** | Better insights → Improved loan approval rates |
| **Bank Trust** | Consistent, accurate analysis → Stronger partnerships |
| **Cost Efficiency** | Optimized prompts → Lower API costs |
| **Regulatory Compliance** | Audit trail for AI decisions → F-100 compliance |

---

## 📊 1. Database-Backed Feedback System (Implemented)

### **Schema Overview**

```sql
ai_chat_messages
  ├── feedback_rating (like/dislike/neutral)
  ├── feedback_comment
  ├── feedback_timestamp
  ├── prompt_tokens, completion_tokens
  ├── response_time_ms
  └── model_version

ai_feedback_analytics (detailed tracking)
  ├── Context: farmer_id, crop_type, phase
  ├── Query: text, length, type
  ├── Response: text, length, structured_data
  ├── Performance: tokens, cost, time
  └── Quality: error_occurred, user_followed_up

ai_quality_metrics (materialized view)
  ├── Aggregated by: model, query_type, crop, phase, date
  ├── Metrics: satisfaction_rate, avg_response_time
  └── Costs: total_cost_usd per segment
```

### **Usage in Code**

```typescript
// Record feedback when user clicks like/dislike
const { data, error } = await supabase.rpc('record_ai_feedback', {
  p_message_id: messageId,
  p_rating: 'like', // or 'dislike'
  p_feedback_comment: 'Very helpful for soil analysis',
  p_feedback_tags: ['accurate', 'clear', 'actionable']
});
```

### **Analytics Queries**

```sql
-- Weekly satisfaction by query type
SELECT 
  query_type,
  satisfaction_rate,
  total_responses,
  total_cost_usd
FROM ai_quality_metrics
WHERE date >= NOW() - INTERVAL '7 days'
ORDER BY total_responses DESC;

-- Identify problematic response patterns
SELECT 
  query_type,
  crop_type,
  phase,
  COUNT(*) as dislike_count,
  AVG(response_length) as avg_length
FROM ai_feedback_analytics
WHERE rating = 'dislike'
GROUP BY query_type, crop_type, phase
HAVING COUNT(*) > 5
ORDER BY dislike_count DESC;

-- Cost analysis by model version
SELECT 
  model_version,
  SUM(api_cost_usd) as total_cost,
  AVG(satisfaction_rate) as avg_satisfaction,
  SUM(api_cost_usd) / NULLIF(SUM(total_responses), 0) as cost_per_response
FROM ai_quality_metrics
GROUP BY model_version;
```

---

## 🔧 2. Industry Best Practice Tools

### **A. LangSmith (Recommended - LangChain)**
**Use Case**: Production-grade LLM application monitoring

```typescript
// Install: npm install langsmith
import { Client } from 'langsmith';

const langsmithClient = new Client({
  apiKey: process.env.LANGCHAIN_API_KEY
});

// Wrap your OpenAI calls with tracing
async function analyzeWithTracking(prompt: string) {
  const runId = await langsmithClient.createRun({
    name: 'agricultural-analysis',
    inputs: { prompt },
    run_type: 'llm',
    metadata: {
      farmerId: farmerId,
      crop: crop,
      phase: phase
    }
  });

  try {
    const response = await openai.chat.completions.create({...});
    
    await langsmithClient.updateRun(runId, {
      outputs: { response: response.choices[0].message.content },
      end_time: new Date()
    });
    
    return response;
  } catch (error) {
    await langsmithClient.updateRun(runId, {
      error: error.message,
      end_time: new Date()
    });
    throw error;
  }
}
```

**Features**:
- ✅ Trace every LLM call with full context
- ✅ A/B test different prompts
- ✅ Dataset management for evaluation
- ✅ Automated prompt optimization
- ✅ Cost tracking per project

**Pricing**: Free tier (5k traces/month) → $39/month (unlimited)

---

### **B. Helicone (Cost-Focused)**
**Use Case**: OpenAI cost tracking and caching

```typescript
// Install: npm install @helicone/node
import { HeliconeAPIClient } from '@helicone/node';

const helicone = new HeliconeAPIClient({
  apiKey: process.env.HELICONE_API_KEY,
  provider: 'openai'
});

// Replace OpenAI endpoint
const response = await fetch('https://oai.helicone.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
    'Helicone-Property-Farm': farmerId,
    'Helicone-Property-Crop': crop,
    'Helicone-Cache-Enabled': 'true' // Cache identical queries
  },
  body: JSON.stringify({...})
});
```

**Features**:
- ✅ Automatic caching (save on duplicate queries)
- ✅ Cost tracking per user/farm/crop
- ✅ Request retries and fallbacks
- ✅ Rate limiting protection
- ✅ Response time monitoring

**Pricing**: Free tier (10k requests/month) → $20/month (100k requests)

---

### **C. Weights & Biases (W&B)**
**Use Case**: ML experiment tracking and model comparison

```python
# For Python-based fine-tuning workflows
import wandb

wandb.init(project='telagri-ai-quality', config={
  'model': 'gpt-4o-mini',
  'temperature': 0.7,
  'dataset': 'agricultural-q-and-a'
})

# Log metrics
wandb.log({
  'satisfaction_rate': 0.87,
  'avg_response_time': 1200,
  'cost_per_1k_tokens': 0.0002
})
```

**Features**:
- ✅ Compare model performance over time
- ✅ Track hyperparameter experiments
- ✅ Dataset versioning
- ✅ Collaborative analysis

**Pricing**: Free for personal use → $50/month per user

---

### **D. PostHog (User Behavior)**
**Use Case**: Understand how specialists use AI features

```typescript
// Install: npm install posthog-js
import posthog from 'posthog-js';

posthog.init(process.env.POSTHOG_API_KEY, {
  api_host: 'https://app.posthog.com'
});

// Track AI interactions
posthog.capture('ai_response_rated', {
  rating: 'like',
  query_type: 'crop_health',
  response_length: 500,
  specialist_experience_level: 'expert'
});
```

**Features**:
- ✅ Session replay (see specialist workflow)
- ✅ Feature flags for A/B testing prompts
- ✅ Funnel analysis (query → response → action)
- ✅ User segmentation

**Pricing**: Free tier (1M events/month) → $0.000225/event

---

## 🚀 3. Improvement Strategies for GPT-4o-mini

### **Strategy A: Prompt Engineering (Immediate)**

**1. Few-Shot Examples**
```typescript
const improvedPrompt = `
You are an agricultural specialist analyzing farmer data for F-100 banking reports.

Examples of good responses:

Q: Analyze soil health for tomato phase 3
A: Based on the soil test results, I've identified three key concerns:

1. **Nitrogen Deficiency** (Current: 15 ppm, Optimal: 40-60 ppm)
   - Impact: Reduced vegetative growth and yield potential
   - Recommendation: Apply 50kg/ha of urea or organic compost
   - Cost: $150-200 for recommended treatment

2. **pH Level** (Current: 5.8, Optimal: 6.0-6.8 for tomatoes)
   - Impact: Limited nutrient availability
   - Recommendation: Apply agricultural lime at 1 ton/ha
   
3. **Organic Matter** (Current: 1.2%, Optimal: >3%)
   - Long-term concern for soil structure
   - Recommendation: Incorporate cover crops between seasons

**F-100 Risk Assessment**: Medium - Addressable with proper inputs

Now analyze: ${userQuery}
`;
```

**2. Structured Output Format**
```typescript
const systemPrompt = `
You must respond in this format:

## Analysis Summary
[2-3 sentence overview]

## Key Findings
1. [Finding with data]
2. [Finding with data]
3. [Finding with data]

## Recommendations
- **Immediate**: [Action with cost/timeline]
- **Short-term**: [Action]
- **Long-term**: [Action]

## F-100 Risk Level
[Low/Medium/High] - [Brief justification]

## Estimated Investment Required
$[amount] - [breakdown]
`;
```

**3. Context Injection**
```typescript
// Add TelAgri-specific context
const contextPrompt = `
Important Context:
- This is for Georgian farmers in [region]
- Crop: ${crop} at Phase ${phase}/12
- Season: [Spring/Summer/Fall/Winter]
- Local market prices: [inject from database]
- Historical yield data: ${farmerHistory}
- Bank's risk tolerance: Conservative (prefer proven methods)
`;
```

---

### **Strategy B: Fine-Tuning (Medium-term, 3-6 months)**

**When to Fine-Tune**:
- ✅ You have 500+ rated interactions
- ✅ Consistent patterns in liked responses
- ✅ Domain-specific terminology (Georgian agriculture)
- ✅ Budget allows ($500-2000 for training + testing)

**Process**:

```bash
# 1. Export highly-rated conversations
SELECT 
  query_text,
  response_text
FROM ai_feedback_analytics
WHERE rating = 'like' 
  AND query_type IN ('crop_health', 'soil_analysis')
ORDER BY created_at DESC
LIMIT 500;

# 2. Format as JSONL for OpenAI fine-tuning
{
  "messages": [
    {"role": "system", "content": "You are an agricultural specialist..."},
    {"role": "user", "content": "Analyze this soil test for wheat phase 4"},
    {"role": "assistant", "content": "Based on the provided data..."}
  ]
}

# 3. Upload to OpenAI
openai api fine_tuning.jobs.create \
  --training_file file-abc123 \
  --model gpt-4o-mini-2024-07-18 \
  --suffix "telagri-v1"

# 4. Test and compare
# Run A/B test: base model vs fine-tuned model
```

**Expected Improvements**:
- 🎯 15-25% increase in satisfaction rate
- 🎯 More consistent response format
- 🎯 Better use of agricultural terminology
- 🎯 Reduced need for follow-up questions

**Cost**: ~$8 per 1M training tokens + inference costs

---

### **Strategy C: RAG Enhancement (Recommended, 1-2 months)**

**Retrieval-Augmented Generation**: Inject relevant knowledge into prompts

```typescript
// 1. Build knowledge base
const knowledgeBase = [
  {
    topic: 'tomato_phase_3_soil',
    content: 'Phase 3 tomato plants require...',
    source: 'Georgian Agriculture Ministry Guidelines 2024',
    confidence: 0.95
  },
  // Add 100s of expert-curated articles
];

// 2. Vector search (using Supabase pgvector)
const { data: relevantDocs } = await supabase.rpc('match_documents', {
  query_embedding: await getEmbedding(userQuery),
  match_threshold: 0.8,
  match_count: 3
});

// 3. Inject into prompt
const enhancedPrompt = `
Relevant Knowledge:
${relevantDocs.map(d => d.content).join('\n\n')}

User Query: ${userQuery}
`;
```

**Benefits**:
- ✅ No fine-tuning cost
- ✅ Easy to update knowledge base
- ✅ Transparent (can show sources)
- ✅ Works with any model

**Implementation**:
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge base table
CREATE TABLE agricultural_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT,
  content TEXT,
  embedding vector(1536), -- OpenAI embedding size
  source TEXT,
  confidence DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vector index
CREATE INDEX ON agricultural_knowledge USING ivfflat (embedding vector_cosine_ops);
```

---

### **Strategy D: Model Cascading (Cost Optimization)**

```typescript
// Use cheaper models for simple queries, expensive for complex
async function intelligentRouting(query: string, complexity: number) {
  if (complexity < 0.3) {
    // Simple question - use GPT-4o-mini
    return await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [...]
    });
  } else if (complexity < 0.7) {
    // Medium complexity - use GPT-4o-mini with RAG
    const docs = await getRelevantDocs(query);
    return await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'system',
        content: `Context: ${docs}\n\nYou are an expert...`
      }, ...]
    });
  } else {
    // Complex/critical - use GPT-4 Turbo
    return await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [...]
    });
  }
}

// Complexity scoring
function assessComplexity(query: string, context: any): number {
  let score = 0;
  
  // Long queries = more complex
  if (query.length > 200) score += 0.2;
  
  // Multiple questions
  if (query.split('?').length > 2) score += 0.3;
  
  // Technical terms
  const technicalTerms = ['disease', 'pathogen', 'deficiency', 'toxicity'];
  technicalTerms.forEach(term => {
    if (query.toLowerCase().includes(term)) score += 0.1;
  });
  
  // High-value context (large farm, high loan amount)
  if (context.loanAmount > 50000) score += 0.2;
  
  return Math.min(score, 1.0);
}
```

---

## 📈 4. Continuous Improvement Workflow

### **Weekly Cycle**

```bash
# Monday: Review metrics
SELECT * FROM ai_quality_metrics WHERE date >= NOW() - INTERVAL '7 days';

# Tuesday: Analyze disliked responses
SELECT query_text, response_text, feedback_comment
FROM ai_feedback_analytics
WHERE rating = 'dislike'
  AND created_at >= NOW() - INTERVAL '7 days';

# Wednesday: Identify patterns and update prompts
# Thursday: Test improved prompts with specialists
# Friday: Deploy updates and refresh metrics
```

### **Monthly Cycle**

1. **Export dataset** (liked + disliked responses)
2. **Manual review** by agricultural experts
3. **Update knowledge base** with new learnings
4. **A/B test** prompt variations
5. **Measure impact** on satisfaction rate

### **Quarterly Cycle**

1. **Cost-benefit analysis** (API costs vs value delivered)
2. **Consider fine-tuning** if sufficient data
3. **Review model upgrades** (OpenAI releases new models)
4. **Stakeholder review** with bank partners

---

## 🎯 5. Success Metrics (KPIs)

| Metric | Target | Current | Action if Below Target |
|--------|--------|---------|----------------------|
| **Satisfaction Rate** | >80% | Track weekly | Review disliked responses |
| **Avg Response Time** | <2s | Track weekly | Optimize prompts |
| **Follow-up Rate** | <20% | Track weekly | Improve clarity |
| **Cost per Query** | <$0.01 | Track daily | Enable caching, optimize |
| **Error Rate** | <2% | Track real-time | Add retries, fallbacks |
| **Specialist Adoption** | >90% | Track monthly | Training, UX improvements |

---

## 🛠️ 6. Implementation Roadmap

### **Phase 1: Foundation (Weeks 1-2)** ✅
- [x] Database schema for feedback tracking
- [x] UI for like/dislike buttons
- [x] Basic analytics queries

### **Phase 2: Observability (Weeks 3-4)**
- [ ] Integrate Helicone for cost tracking
- [ ] Set up LangSmith for trace analysis
- [ ] Create dashboard for metrics visualization
- [ ] Add Slack alerts for low satisfaction

### **Phase 3: Optimization (Weeks 5-8)**
- [ ] Implement prompt engineering improvements
- [ ] Build RAG system with knowledge base
- [ ] Add intelligent model routing
- [ ] Enable response caching

### **Phase 4: Advanced (Months 3-6)**
- [ ] Fine-tune custom model on TelAgri data
- [ ] Multi-language support (Georgian + English)
- [ ] Automated prompt optimization
- [ ] Integration with bank feedback systems

---

## 💡 Recommended Immediate Actions

1. **Apply the migration** to add feedback tracking
   ```bash
   supabase db push
   ```

2. **Integrate Helicone** (30 minutes setup, immediate cost savings)
   ```bash
   npm install @helicone/node
   # Update OpenAI endpoint
   ```

3. **Create analytics dashboard** (use Supabase Studio or Metabase)
   - Weekly satisfaction rate chart
   - Cost per query by crop/phase
   - Most disliked response types

4. **Review first 50 disliked responses manually**
   - Identify common issues
   - Update system prompt accordingly

5. **A/B test improved prompts** with 2-3 specialists
   - Measure satisfaction increase
   - Roll out if >10% improvement

---

## 📚 Additional Resources

- **OpenAI Fine-tuning Guide**: https://platform.openai.com/docs/guides/fine-tuning
- **LangSmith Documentation**: https://docs.smith.langchain.com/
- **RAG Best Practices**: https://www.pinecone.io/learn/retrieval-augmented-generation/
- **Prompt Engineering Guide**: https://www.promptingguide.ai/

---

## 🔐 Security & Compliance Notes

- ✅ All feedback data encrypted at rest (Supabase)
- ✅ No PII in prompts sent to OpenAI
- ✅ Audit trail for all AI interactions
- ✅ GDPR-compliant data retention (configurable)
- ✅ Bank-grade access controls (RLS policies)

---

**Next Steps**: Schedule a 30-minute session with the team to review this strategy and prioritize implementation phases based on current business priorities.

