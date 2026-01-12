'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import Link from 'next/link'

export default function FAQsFour() {
    const faqItems = [
        {
            id: 'item-1',
            question: 'What is Dilag?',
            answer: 'Dilag is a native macOS app that uses AI to generate mobile and web UI designs from natural language descriptions. Simply describe what you want, and watch it come to life.',
        },
        {
            id: 'item-2',
            question: 'What AI models are supported?',
            answer: 'Dilag works with OpenCode, which supports Claude, GPT-5.2, Gemini, and other popular AI models. You can choose your preferred model in the settings.',
        },
        {
            id: 'item-3',
            question: 'Can I export my designs?',
            answer: 'Yes! Dilag generates real HTML and CSS code that you can copy and use in your projects.',
        },
        {
            id: 'item-4',
            question: 'Is Dilag free?',
            answer: 'Dilag offers a free trial so you can try it out. For continued access and to support development, you can purchase a Pro license.',
        },
        {
            id: 'item-5',
            question: 'What platforms are supported?',
            answer: 'Dilag currently runs on macOS (both Apple Silicon and Intel). Windows and Linux versions are planned for the future.',
        },
        {
            id: 'item-6',
            question: 'Do I need an internet connection?',
            answer: 'Yes, Dilag requires an internet connection to communicate with the AI models. Your designs are generated in real-time using cloud-based AI.',
        },
        {
            id: 'item-7',
            question: 'What do I need to run Dilag?',
            answer: 'You need macOS and OpenCode installed. OpenCode provides the AI backend that powers Dilag\'s design generation.',
        },
        {
            id: 'item-8',
            question: 'How does the one-time payment work?',
            answer: 'You pay once and get lifetime access to Dilag Pro, including all future updates. No subscriptions, no recurring fees.',
        },
    ]

    return (
        <section className="py-16 md:py-24">
            <div className="mx-auto max-w-5xl px-4 md:px-6">
                <div className="mx-auto max-w-xl text-center">
                    <h2 className="text-balance text-3xl font-bold md:text-4xl lg:text-5xl">Frequently Asked Questions</h2>
                    <p className="text-muted-foreground mt-4 font-sans text-balance">Everything you need to know about Dilag and how it works.</p>
                </div>

                <div className="mx-auto mt-12 max-w-xl">
                    <Accordion
                        type="single"
                        collapsible
                        className="bg-muted dark:bg-muted/50 w-full rounded-2xl p-1">
                        {faqItems.map((item) => (
                            <div
                                className="group"
                                key={item.id}>
                                <AccordionItem
                                    value={item.id}
                                    className="data-[state=open]:bg-card dark:data-[state=open]:bg-muted peer rounded-xl border-none px-7 py-1 data-[state=open]:border-none data-[state=open]:shadow-sm">
                                    <AccordionTrigger className="cursor-pointer font-sans text-base hover:no-underline">{item.question}</AccordionTrigger>
                                    <AccordionContent>
                                        <p className="font-sans text-base">{item.answer}</p>
                                    </AccordionContent>
                                </AccordionItem>
                                <hr className="mx-7 border-dashed group-last:hidden peer-data-[state=open]:opacity-0" />
                            </div>
                        ))}
                    </Accordion>

                    <p className="text-muted-foreground mt-6 font-sans px-8">
                        Can't find what you're looking for?{' '}
                        <Link
                            href="https://github.com/noelrohi/dilag/issues"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-medium hover:underline">
                            Open an issue on GitHub
                        </Link>
                    </p>
                </div>
            </div>
        </section>
    )
}
