export interface ChatRequest {
  provider: string;
  model: string;
  prompt: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface Env {
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  DEEPSEEK_API_KEY: string;
  QWEN_API_KEY: string;
  MINIMAX_API_KEY: string;
  GOOGLE_API_KEY: string;
  GROQ_API_KEY: string;
  HUGGINGFACE_API_KEY: string;
  TOGETHERAI_API_KEY: string;
  FIREWORKS_API_KEY: string;
  MISTRAL_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  OPENROUTER_API_KEY: string;
  COHERE_API_KEY: string;
  AI21_API_KEY: string;
  NOVITA_API_KEY: string;
  XAI_API_KEY: string;
  ZEROONE_API_KEY: string;
  STEPEUN_API_KEY: string;
  BAICHUAN_API_KEY: string;
  MOONSHOT_API_KEY: string;
  WENXIN_API_KEY: string;
  ZHIPU_API_KEY: string;
  TONGYI_API_KEY: string;
  TAVILY_API_KEY: string;
  CLOUDFLARE_API_KEY: string;
  AZURE_OPENAI_KEY: string;
  AZURE_OPENAI_ENDPOINT: string;
  NEW_RELIC_API_KEY: string;
  WORKER_ACCESS_TOKEN: string;
}
