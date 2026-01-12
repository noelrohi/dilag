import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Lightning, CodeBlock, Sparkle } from '@phosphor-icons/react/dist/ssr'
import { ReactNode } from 'react'

export default function Features() {
    return (
        <section className="bg-zinc-50 py-16 md:py-32 dark:bg-transparent">
            <div className="@container mx-auto max-w-5xl px-6">
                <div className="text-center">
                    <h2 className="text-balance text-4xl font-semibold lg:text-5xl">Built for designers and developers</h2>
                    <p className="mt-4 text-muted-foreground">Generate beautiful UI designs from natural language, powered by AI.</p>
                </div>
                <div className="@min-4xl:max-w-full @min-4xl:grid-cols-3 mx-auto mt-8 grid max-w-sm gap-6 *:text-center md:mt-16">
                    <Card className="group shadow-zinc-950/5">
                        <CardHeader className="pb-3">
                            <CardDecorator>
                                <Lightning size={24} />
                            </CardDecorator>

                            <h3 className="mt-6 font-sans font-medium">Lightning Fast</h3>
                        </CardHeader>

                        <CardContent>
                            <p className="text-sm">Generate complete UI designs in seconds. Describe what you want and watch it come to life in real-time.</p>
                        </CardContent>
                    </Card>

                    <Card className="group shadow-zinc-950/5">
                        <CardHeader className="pb-3">
                            <CardDecorator>
                                <CodeBlock size={24} />
                            </CardDecorator>

                            <h3 className="mt-6 font-sans font-medium">Export Real Code</h3>
                        </CardHeader>

                        <CardContent>
                            <p className="mt-3 text-sm">Get production-ready HTML and CSS code that you can copy directly into your projects.</p>
                        </CardContent>
                    </Card>

                    <Card className="group shadow-zinc-950/5">
                        <CardHeader className="pb-3">
                            <CardDecorator>
                                <Sparkle size={24} />
                            </CardDecorator>

                            <h3 className="mt-6 font-sans font-medium">Powered By AI</h3>
                        </CardHeader>

                        <CardContent>
                            <p className="mt-3 text-sm">Choose from Claude, GPT-5.2, Gemini, and more. Use the AI model that works best for you.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>
    )
}

const CardDecorator = ({ children }: { children: ReactNode }) => (
    <div className="mask-radial-from-40% mask-radial-to-60% relative mx-auto size-36 duration-200 [--color-border:color-mix(in_oklab,var(--color-zinc-950)10%,transparent)] group-hover:[--color-border:color-mix(in_oklab,var(--color-zinc-950)20%,transparent)] dark:[--color-border:color-mix(in_oklab,var(--color-white)15%,transparent)] dark:group-hover:[--color-border:color-mix(in_oklab,var(--color-white)20%,transparent)]">
        <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-50"
        />

        <div className="bg-background absolute inset-0 m-auto flex size-12 items-center justify-center border-l border-t">{children}</div>
    </div>
)
