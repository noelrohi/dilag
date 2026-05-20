import { cn } from "@/lib/utils"

// Logo component that fetches from models.dev
function ProviderLogo({ provider, className }: { provider: string; className?: string }) {
  return (
    <img
      alt={`${provider} logo`}
      className={cn("size-6 dark:invert", className)}
      src={`https://models.dev/logos/${provider}.svg`}
    />
  )
}

export default function IntegrationsSection() {
  return (
    <section>
      <div className="bg-muted dark:bg-background py-24 md:py-32">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <h2 className="text-balance text-3xl font-semibold md:text-4xl lg:text-5xl">
              Connect any AI provider
            </h2>
            <p className="text-muted-foreground">
              Connect your preferred AI provider and use leading models for design generation,
              iteration, and refinement.
            </p>
          </div>

          <div className="mt-10 -mx-6 px-6 [mask-image:radial-gradient(ellipse_100%_100%_at_50%_0%,#000_70%,transparent_100%)]">
            <div className="bg-background dark:bg-muted/50 rounded-2xl border p-3 shadow-lg">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                <Integration
                  provider="openai"
                  name="OpenAI"
                  description="GPT/Codex and the latest models."
                />
                <Integration
                  provider="opencode-go"
                  name="OpenCode Go"
                  description="OpenCode's hosted model gateway."
                />
                <Integration
                  provider="google"
                  name="Google"
                  description="Gemini for multimodal design."
                />
                <Integration
                  provider="openrouter"
                  name="OpenRouter"
                  description="Route across hundreds of models."
                />
                <Integration
                  provider="anthropic"
                  name="Anthropic"
                  description="Claude models with advanced reasoning."
                />
                <Integration
                  provider="github-copilot"
                  name="GitHub Copilot"
                  description="Subscription models from GitHub."
                />
                <Integration
                  provider="deepseek"
                  name="DeepSeek"
                  description="Reasoning and coding models."
                />
                <Integration
                  provider="mistral"
                  name="Mistral"
                  description="Fast, capable open models."
                />
                <Integration provider="groq" name="Groq" description="Low-latency inference." />
                <Integration
                  provider="cerebras"
                  name="Cerebras"
                  description="Blazing fast inference."
                />
                <Integration provider="xai" name="xAI" description="Grok models for coding." />
                <Integration
                  provider="vercel-ai-gateway"
                  name="Vercel AI Gateway"
                  description="Unified access to hosted models."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const Integration = ({
  provider,
  name,
  description,
}: {
  provider: string
  name: string
  description: string
}) => {
  return (
    <div className="hover:bg-muted dark:hover:bg-muted/50 space-y-3 rounded-lg border p-4 transition-colors">
      <div className="flex size-fit items-center justify-center">
        <ProviderLogo provider={provider} />
      </div>
      <div className="space-y-1">
        <h3 className="font-sans text-sm font-medium">{name}</h3>
        <p className="text-muted-foreground line-clamp-1 text-sm md:line-clamp-2">{description}</p>
      </div>
    </div>
  )
}
