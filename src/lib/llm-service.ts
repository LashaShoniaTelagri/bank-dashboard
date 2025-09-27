// LLM Service for TelAgri Monitoring
// Secure AI analysis integration with banking-grade security

import { supabase } from '../integrations/supabase/client';
import { LLMProvider, AnalysisResult, LLMApiKey, FarmerDataUpload } from '../types/specialist';

// LLM Service class for managing AI analysis
export class LLMService {
  private static instance: LLMService;
  // Removed per policy: specialists cannot store their own keys.
  private apiKeys: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  // Disabled: storing user-provided keys is not allowed for specialists
  async storeApiKey(): Promise<void> {
    throw new Error('Storing API keys is disabled for this environment.');
  }

  // Retrieve API key - now uses server-managed environment key via Edge Function proxy
  async getApiKey(): Promise<string> {
    throw new Error('Direct API key access is disabled. Use the server proxy.');
  }

  // List available API keys
  async listApiKeys(): Promise<LLMApiKey[]> {
    try {
      const { data, error } = await supabase
        .from('llm_api_keys')
        .select('*')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to list API keys: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error listing API keys:', error);
      throw error;
    }
  }

  // Delete API key
  async deleteApiKey(keyId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('llm_api_keys')
        .delete()
        .eq('id', keyId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) {
        throw new Error(`Failed to delete API key: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      throw error;
    }
  }

  // Analyze data using OpenAI GPT
  async analyzeWithOpenAI(
    prompt: string,
    contextData: Record<string, unknown>,
    model: string = 'gpt-4',
    attachedFiles?: FarmerDataUpload[]
  ): Promise<AnalysisResult> {
    try {
      // Call secured proxy (Edge Function) that injects OpenAI key server-side
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke('ai-chat', {
        body: {
          // No provider/model or system prompts from client
          messages: [
            {
              role: 'user',
              content: `Context Data: ${JSON.stringify(contextData, null, 2)}\n\nAnalysis Request: ${prompt}`
            }
          ],
          attachedFiles: attachedFiles || []
        }
      });

      if (proxyError || !proxyData) {
        throw new Error(`AI proxy error: ${proxyError?.message || 'Unknown error'}`);
      }

      const data = proxyData as any;
      const analysis = data.choices[0]?.message?.content;

      if (!analysis) {
        throw new Error('No analysis generated');
      }

      // Update usage statistics
      await this.updateApiKeyUsage('openai', 'default', data.usage);

      return {
        success: true,
        data: {
          analysis,
          recommendations: this.extractRecommendations(analysis),
          confidence_score: 0.85, // Could be calculated based on response quality
          processing_time: Date.now(),
          model_used: model
        }
      };
    } catch (error) {
      console.error('OpenAI analysis error:', error);
      return {
        success: false,
        error: {
          code: 'OPENAI_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { provider: 'openai', model }
        }
      };
    }
  }

  // Generic analysis method (OpenAI-only)
  async analyzeData(
    prompt: string,
    contextData: Record<string, unknown>,
    preferredProvider?: LLMProvider,
    attachedFiles?: FarmerDataUpload[]
  ): Promise<AnalysisResult> {
    return await this.analyzeWithOpenAI(prompt, contextData, 'gpt-4', attachedFiles);
  }

  // Extract recommendations from analysis text
  private extractRecommendations(analysis: string): string[] {
    const recommendations: string[] = [];
    const lines = analysis.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[-•]\s/) || trimmed.match(/^\d+\.\s/)) {
        recommendations.push(trimmed.replace(/^[-•]\s/, '').replace(/^\d+\.\s/, ''));
      }
    }
    
    return recommendations.length > 0 ? recommendations : ['Review the analysis for specific recommendations'];
  }

  // Update API key usage statistics
  private async updateApiKeyUsage(provider: LLMProvider, keyName: string, usage: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('llm_api_keys')
        .update({
          usage_count: supabase.sql`usage_count + 1`,
          last_used_at: new Date().toISOString()
        })
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .eq('provider', provider)
        .eq('key_name', keyName);

      if (error) {
        console.warn('Failed to update API key usage:', error);
      }
    } catch (error) {
      console.warn('Error updating API key usage:', error);
    }
  }

  // Validate API key
  async validateApiKey(): Promise<boolean> {
    try {
      // Client no longer validates keys
      return true;
    } catch (error) {
      console.error('API key validation error:', error);
      return false;
    }
  }

  // Clear cached API keys (for security)
  clearCache(): void {
    this.apiKeys.clear();
  }
}

// Export singleton instance
export const llmService = LLMService.getInstance();

// Utility functions for common analysis tasks
export const AnalysisPrompts = {
  cropHealth: (data: Record<string, unknown>) => `
    Analyze the crop health data provided. Focus on:
    - Disease and pest identification
    - Nutrient deficiencies
    - Growth stage assessment
    - Yield potential
    - Recommended interventions
    
    Data: ${JSON.stringify(data, null, 2)}
  `,

  soilAnalysis: (data: Record<string, unknown>) => `
    Analyze the soil data provided. Focus on:
    - Soil composition and pH levels
    - Nutrient content and availability
    - Organic matter levels
    - Drainage and water retention
    - Fertilization recommendations
    
    Data: ${JSON.stringify(data, null, 2)}
  `,

  irrigationOptimization: (data: Record<string, unknown>) => `
    Analyze the irrigation and water management data. Focus on:
    - Water usage efficiency
    - Irrigation system performance
    - Water quality assessment
    - Seasonal water requirements
    - Optimization recommendations
    
    Data: ${JSON.stringify(data, null, 2)}
  `,

  financialRisk: (data: Record<string, unknown>) => `
    Analyze the financial and risk data for agricultural lending. Focus on:
    - Crop yield projections
    - Market price trends
    - Weather risk factors
    - Farmer's financial capacity
    - Loan repayment probability
    - Risk mitigation strategies
    
    Data: ${JSON.stringify(data, null, 2)}
  `,

  complianceReview: (data: Record<string, unknown>) => `
    Review the compliance and regulatory data. Focus on:
    - Environmental regulations compliance
    - Safety standards adherence
    - Certification requirements
    - Documentation completeness
    - Regulatory risk assessment
    
    Data: ${JSON.stringify(data, null, 2)}
  `
};