// Provider API key environment variable mapping
export const PROVIDER_API_KEYS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  qwen: 'QWEN_API_KEY',
  minimax: 'MINIMAX_API_KEY',
  google: 'GOOGLE_API_KEY',
  groq: 'GROQ_API_KEY',
  huggingface: 'HUGGINGFACE_API_KEY',
  togetherai: 'TOGETHERAI_API_KEY',
  fireworksai: 'FIREWORKS_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  cohere: 'COHERE_API_KEY',
  ai21: 'AI21_API_KEY',
  novita: 'NOVITA_API_KEY',
  xai: 'XAI_API_KEY',
  zeroone: 'ZEROONE_API_KEY',
  stepfun: 'STEPEUN_API_KEY',
  baichuan: 'BAICHUAN_API_KEY',
  moonshot: 'MOONSHOT_API_KEY',
  wenxin: 'WENXIN_API_KEY',
  zhipu: 'ZHIPU_API_KEY',
  azure: 'AZURE_OPENAI_KEY',
};

// Provider configurations
export const PROVIDERS: Record<string, {
  baseURL: string;
  apiKeyEnv: string;
  headers?: (apiKey: string) => Record<string, string>;
}> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
  },
  qwen: {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'QWEN_API_KEY',
  },
  minimax: {
    baseURL: 'https://api.minimaxi.chat/v1',
    apiKeyEnv: 'MINIMAX_API_KEY',
  },
  google: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnv: 'GOOGLE_API_KEY',
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
  },
  huggingface: {
    baseURL: 'https://api-inference.huggingface.co/v1',
    apiKeyEnv: 'HUGGINGFACE_API_KEY',
  },
  togetherai: {
    baseURL: 'https://api.together.xyz/v1',
    apiKeyEnv: 'TOGETHERAI_API_KEY',
  },
  fireworksai: {
    baseURL: 'https://api.fireworks.ai/inference/v1',
    apiKeyEnv: 'FIREWORKS_API_KEY',
  },
  mistral: {
    baseURL: 'https://api.mistral.ai/v1',
    apiKeyEnv: 'MISTRAL_API_KEY',
  },
  perplexity: {
    baseURL: 'https://api.perplexity.ai',
    apiKeyEnv: 'PERPLEXITY_API_KEY',
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
  },
  cohere: {
    baseURL: 'https://api.cohere.ai/v2',
    apiKeyEnv: 'COHERE_API_KEY',
  },
  ai21: {
    baseURL: 'https://api.ai21.com/v1',
    apiKeyEnv: 'AI21_API_KEY',
  },
  novita: {
    baseURL: 'https://api.novita.ai/v1',
    apiKeyEnv: 'NOVITA_API_KEY',
  },
  xai: {
    baseURL: 'https://api.x.ai/v1',
    apiKeyEnv: 'XAI_API_KEY',
  },
  zeroone: {
    baseURL: 'https://api.01.ai/v1',
    apiKeyEnv: 'ZEROONE_API_KEY',
  },
  stepfun: {
    baseURL: 'https://api.stepfun.com/v1',
    apiKeyEnv: 'STEPEUN_API_KEY',
  },
  baichuan: {
    baseURL: 'https://api.baichuan.com/v1',
    apiKeyEnv: 'BAICHUAN_API_KEY',
  },
  moonshot: {
    baseURL: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'MOONSHOT_API_KEY',
  },
  wenxin: {
    baseURL: 'https://qianfan.baidubce.com/v2',
    apiKeyEnv: 'WENXIN_API_KEY',
  },
  zhipu: {
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyEnv: 'ZHIPU_API_KEY',
  },
  azure: {
    baseURL: '', // Will be constructed from endpoint
    apiKeyEnv: 'AZURE_OPENAI_KEY',
  },
};
