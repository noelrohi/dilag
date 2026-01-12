import { cn } from '@/lib/utils'

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
                <div className="mx-auto flex flex-col px-6 md:grid md:max-w-5xl md:grid-cols-2 md:gap-12">
                    <div className="order-last mt-6 flex flex-col gap-12 md:order-first">
                        <div className="space-y-6">
                            <h2 className="text-balance text-3xl font-semibold md:text-4xl lg:text-5xl">Connect any AI provider</h2>
                            <p className="text-muted-foreground">Dilag uses OpenCode under the hood, giving you access to dozens of AI models through multiple providers.</p>
                        </div>
                    </div>

                    <div className="-mx-6 px-6 [mask-image:radial-gradient(ellipse_100%_100%_at_50%_0%,#000_70%,transparent_100%)] sm:mx-auto sm:max-w-md md:-mx-6 md:ml-auto md:mr-0">
                        <div className="bg-background dark:bg-muted/50 rounded-2xl border p-3 shadow-lg md:pb-12">
                            <div className="grid grid-cols-2 gap-2">
                                <Integration
                                    provider="anthropic"
                                    name="Anthropic"
                                    description="Claude models with advanced reasoning."
                                />
                                <Integration
                                    provider="openai"
                                    name="OpenAI"
                                    description="GPT-5.2 and the latest models."
                                />
                                <Integration
                                    provider="google"
                                    name="Google"
                                    description="Gemini for multimodal design."
                                />
                                <Integration
                                    provider="opencode"
                                    name="OpenCode Zen"
                                    description="Zero-config, just works."
                                />
                                <Integration
                                    provider="cerebras"
                                    name="Cerebras"
                                    description="Blazing fast inference."
                                />
                                <Integration
                                    provider="github-copilot"
                                    name="GitHub Copilot"
                                    description="AI pair programming."
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

const Integration = ({ provider, name, description }: { provider: string; name: string; description: string }) => {
    return (
        <div className="hover:bg-muted dark:hover:bg-muted/50 space-y-4 rounded-lg border p-4 transition-colors">
            <div className="flex size-fit items-center justify-center">
                <ProviderLogo provider={provider} />
            </div>
            <div className="space-y-1">
                <h3 className="text-sm font-medium">{name}</h3>
                <p className="text-muted-foreground line-clamp-1 text-sm md:line-clamp-2">{description}</p>
            </div>
        </div>
    )
}
