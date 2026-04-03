import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight, Shield, Zap, CloudRain, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnimatedGroup } from '@/components/ui/animated-group'

import { type Variants } from 'framer-motion'

const transitionVariants: { item: Variants; container?: Variants } = {
    item: {
        hidden: {
            opacity: 0,
            filter: 'blur(12px)',
            y: 12,
        },
        visible: {
            opacity: 1,
            filter: 'blur(0px)',
            y: 0,
            transition: {
                type: 'spring',
                bounce: 0.3,
                duration: 1.5,
            },
        },
    },
}

export function HeroSection() {
    return (
        <>
            <main className="overflow-hidden">
                <div
                    aria-hidden
                    className="z-[2] absolute inset-0 pointer-events-none isolate opacity-50 contain-strict hidden lg:block">
                    <div className="w-[35rem] h-[80rem] -translate-y-[350px] absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(260,80%,70%,.08)_0,hsla(260,60%,55%,.02)_50%,hsla(260,40%,45%,0)_80%)]" />
                    <div className="h-[80rem] absolute left-0 top-0 w-56 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(260,80%,70%,.06)_0,hsla(260,40%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
                    <div className="h-[80rem] -translate-y-[350px] absolute left-0 top-0 w-56 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(260,80%,70%,.04)_0,hsla(260,40%,45%,.02)_80%,transparent_100%)]" />
                </div>
                <section>
                    <div className="relative pt-24 md:pt-36">
                        <AnimatedGroup
                            variants={{
                                container: {
                                    visible: {
                                        transition: {
                                            delayChildren: 1,
                                        },
                                    },
                                },
                                item: {
                                    hidden: {
                                        opacity: 0,
                                        y: 20,
                                    },
                                    visible: {
                                        opacity: 1,
                                        y: 0,
                                        transition: {
                                            type: 'spring',
                                            bounce: 0.3,
                                            duration: 2,
                                        },
                                    },
                                },
                            }}
                            className="absolute inset-0 -z-20">
                            <img
                                src="https://ik.imagekit.io/lrigu76hy/tailark/night-background.jpg?updatedAt=1745733451120"
                                alt="background"
                                className="absolute inset-x-0 top-56 -z-20 hidden lg:top-32 dark:block"
                                width="3276"
                                height="4095"
                            />
                        </AnimatedGroup>
                        <div aria-hidden className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--background)_75%)]" />
                        <div className="mx-auto max-w-7xl px-6">
                            <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                                <AnimatedGroup variants={transitionVariants}>
                                    <Link
                                        to="/simulate"
                                        className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-black/5 transition-all duration-300 dark:border-t-white/5 dark:shadow-zinc-950">
                                        <span className="text-foreground text-sm">AI-Powered Parametric Insurance</span>
                                        <span className="dark:border-background block h-4 w-0.5 border-l bg-white dark:bg-zinc-700"></span>

                                        <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
                                            <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                                                <span className="flex size-6">
                                                    <ArrowRight className="m-auto size-3" />
                                                </span>
                                                <span className="flex size-6">
                                                    <ArrowRight className="m-auto size-3" />
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                        
                                    <h1
                                        className="mt-8 max-w-4xl mx-auto text-balance text-6xl md:text-7xl lg:mt-16 xl:text-[5.25rem] font-bold tracking-tighter">
                                        Protection that starts{' '}
                                        <span className="bg-gradient-to-r from-[#7033ff] to-[#8c5cff] bg-clip-text text-transparent">before the loss.</span>
                                    </h1>
                                    <p
                                        className="mx-auto mt-8 max-w-2xl text-balance text-lg text-muted-foreground">
                                        The AI-powered parametric safety net designed to protect quick-commerce workers from weather disruptions, bandhs, and external risks — with instant payouts.
                                    </p>
                                </AnimatedGroup>

                                <AnimatedGroup
                                    variants={{
                                        container: {
                                            visible: {
                                                transition: {
                                                    staggerChildren: 0.05,
                                                    delayChildren: 0.75,
                                                },
                                            },
                                        },
                                        ...transitionVariants,
                                    }}
                                    className="mt-12 flex flex-col items-center justify-center gap-2 md:flex-row">
                                    <div
                                        key={1}
                                        className="bg-foreground/10 rounded-[14px] border p-0.5">
                                        <Button
                                            asChild
                                            size="lg"
                                            className="rounded-xl px-5 text-base">
                                            <Link to="/simulate">
                                                <span className="text-nowrap">Run Simulation</span>
                                            </Link>
                                        </Button>
                                    </div>
                                    <Button
                                        key={2}
                                        asChild
                                        size="lg"
                                        variant="ghost"
                                        className="h-10.5 rounded-xl px-5">
                                        <Link to="/story">
                                            <span className="text-nowrap">See the Story</span>
                                        </Link>
                                    </Button>
                                </AnimatedGroup>
                            </div>
                        </div>

                        <AnimatedGroup
                            variants={{
                                container: {
                                    visible: {
                                        transition: {
                                            staggerChildren: 0.05,
                                            delayChildren: 0.75,
                                        },
                                    },
                                },
                                ...transitionVariants,
                            }}>
                            <div className="relative -mr-56 mt-8 overflow-hidden px-2 sm:mr-0 sm:mt-12 md:mt-20">
                                <div
                                    aria-hidden
                                    className="bg-gradient-to-b to-background absolute inset-0 z-10 from-transparent from-35%"
                                />
                                <div className="inset-shadow-2xs ring-background dark:inset-shadow-white/20 bg-background relative mx-auto max-w-6xl overflow-hidden rounded-2xl border p-4 shadow-lg shadow-zinc-950/15 ring-1">
                                    <div className="bg-card aspect-15/8 relative rounded-2xl border border-border/25 p-8 flex flex-col items-center justify-center gap-6">
                                        {/* Dashboard Preview */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
                                            <div className="bg-background/80 rounded-xl border border-border/50 p-5 flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-[#7033ff]/10 flex items-center justify-center">
                                                    <Shield className="w-5 h-5 text-[#7033ff]" />
                                                </div>
                                                <span className="text-sm font-medium text-foreground">Smart Contracts</span>
                                                <span className="text-xs text-muted-foreground text-center">Automatic trigger & payout via blockchain</span>
                                            </div>
                                            <div className="bg-background/80 rounded-xl border border-border/50 p-5 flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-[#4ac885]/10 flex items-center justify-center">
                                                    <Zap className="w-5 h-5 text-[#4ac885]" />
                                                </div>
                                                <span className="text-sm font-medium text-foreground">Instant Payouts</span>
                                                <span className="text-xs text-muted-foreground text-center">Sub-minute claims with zero paperwork</span>
                                            </div>
                                            <div className="bg-background/80 rounded-xl border border-border/50 p-5 flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-[#3276e4]/10 flex items-center justify-center">
                                                    <CloudRain className="w-5 h-5 text-[#3276e4]" />
                                                </div>
                                                <span className="text-sm font-medium text-foreground">Weather Oracle</span>
                                                <span className="text-xs text-muted-foreground text-center">Real-time weather data triggers coverage</span>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                                            <Activity className="w-3 h-3 text-[#4ac885]" />
                                            <span>Live monitoring across 12 Indian cities</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </AnimatedGroup>
                    </div>
                </section>
                <section className="bg-background pb-16 pt-16 md:pb-32">
                    <div className="group relative m-auto max-w-5xl px-6">
                        <div className="absolute inset-0 z-10 flex scale-95 items-center justify-center opacity-0 duration-500 group-hover:scale-100 group-hover:opacity-100">
                            <Link
                                to="/rider"
                                className="block text-sm duration-150 hover:opacity-75">
                                <span>Explore the Platform</span>
                                <ChevronRight className="ml-1 inline-block size-3" />
                            </Link>
                        </div>
                        <div className="group-hover:blur-xs mx-auto mt-12 grid max-w-3xl grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-8 transition-all duration-500 group-hover:opacity-50 sm:gap-x-16 sm:gap-y-14">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-3xl font-bold text-foreground">12+</span>
                                <span className="text-xs text-muted-foreground">Cities Covered</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-3xl font-bold text-foreground">50K+</span>
                                <span className="text-xs text-muted-foreground">Riders Protected</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-3xl font-bold text-foreground">&lt;60s</span>
                                <span className="text-xs text-muted-foreground">Avg Payout Time</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-3xl font-bold text-foreground">99.2%</span>
                                <span className="text-xs text-muted-foreground">Fraud Detected</span>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}

export default HeroSection
