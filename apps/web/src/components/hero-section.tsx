import Link from 'next/link'
import { Download, Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { TextEffect } from '@/components/ui/text-effect'
import { AnimatedGroup } from '@/components/ui/animated-group'
import { HeroHeader } from './header'

export default function HeroSection() {
    return (
        <>
            <HeroHeader />
            <main className="overflow-hidden">
                <div
                    aria-hidden
                    className="absolute inset-0 isolate hidden opacity-65 contain-strict lg:block">
                    <div className="w-140 h-320 -translate-y-87.5 absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
                    <div className="h-320 absolute left-0 top-0 w-60 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
                    <div className="h-320 -translate-y-87.5 absolute left-0 top-0 w-60 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
                </div>
                <section>
                    <div className="relative pt-24 md:pt-36">
                        <div
                            aria-hidden
                            className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--color-background)_75%)]"
                        />

                        <div className="mx-auto max-w-7xl px-6">
                            <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                                <TextEffect
                                    preset="fade-in-blur"
                                    speedSegment={0.3}
                                    as="h1"
                                    className="mx-auto mt-8 max-w-4xl text-balance text-5xl font-bold md:text-7xl lg:mt-16 xl:text-[5.25rem]">
                                    Design apps with natural language
                                </TextEffect>
                                <TextEffect
                                    per="line"
                                    preset="fade-in-blur"
                                    speedSegment={0.3}
                                    delay={0.5}
                                    as="p"
                                    className="text-muted-foreground mx-auto mt-8 max-w-2xl text-balance text-lg">
                                    Describe your idea and watch Dilag generate beautiful mobile and web UI designs in real-time.
                                </TextEffect>

                                <AnimatedGroup className="mt-12 flex flex-col items-center justify-center gap-2 md:flex-row">
                                    <div className="bg-foreground/10 rounded-[calc(var(--radius-xl)+0.125rem)] border p-0.5">
                                        <Button
                                            asChild
                                            size="lg"
                                            className="rounded-xl px-5 text-base">
                                            <a href="https://github.com/noelrohi/dilag/releases/latest">
                                                <Download className="mr-2 size-4" />
                                                <span className="text-nowrap">Download for macOS</span>
                                            </a>
                                        </Button>
                                    </div>
                                    <Button
                                        asChild
                                        size="lg"
                                        variant="ghost"
                                        className="h-10.5 rounded-xl px-5">
                                        <a
                                            href="https://github.com/noelrohi/dilag"
                                            target="_blank"
                                            rel="noopener noreferrer">
                                            <Github className="mr-2 size-4" />
                                            <span className="text-nowrap">View Source</span>
                                        </a>
                                    </Button>
                                </AnimatedGroup>
                            </div>
                        </div>

                        <AnimatedGroup className="relative mt-8 overflow-hidden px-4 sm:mt-12 md:mt-20">
                            <div className="ring-background dark:ring-white/10 bg-background relative mx-auto max-w-6xl overflow-hidden rounded-2xl border shadow-2xl shadow-zinc-950/25 ring-1">
                                <Image
                                    className="w-full h-auto"
                                    src="/hero-dark.png"
                                    alt="Dilag app screenshot"
                                    width="2700"
                                    height="1440"
                                    priority
                                />
                            </div>
                        </AnimatedGroup>
                    </div>
                </section>
            </main>
        </>
    )
}
