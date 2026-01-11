import { DilagLogo } from "@/components/dilag-logo";
import { Download, Github, Sparkles, Wand2, Layers, MessageSquare, Smartphone, Palette } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[128px] opacity-50" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[96px] opacity-30" />
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
                              linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
            backgroundSize: '64px 64px'
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DilagLogo className="w-8 h-8" />
            <span className="font-semibold text-lg tracking-tight">Dilag</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/noelrohi/dilag"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <a
              href="https://github.com/noelrohi/dilag/releases/latest"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Mobile UI Design</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-slide-up opacity-0 delay-100">
            Design mobile screens with{" "}
            <span className="text-gradient">natural language</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up opacity-0 delay-200 leading-relaxed">
            Describe your app idea and watch Dilag generate beautiful, 
            responsive mobile UI designs in real-time. Powered by OpenCode.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up opacity-0 delay-300">
            <a
              href="https://github.com/noelrohi/dilag/releases/latest"
              className="group flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-xl text-lg font-semibold hover:opacity-90 transition-all animate-pulse-glow"
            >
              <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
              Download for macOS
            </a>
            <a
              href="https://github.com/noelrohi/dilag"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-8 py-4 border border-border rounded-xl text-lg font-medium hover:bg-secondary transition-colors"
            >
              <Github className="w-5 h-5" />
              View on GitHub
            </a>
          </div>

          {/* Platform info */}
          <p className="text-sm text-muted-foreground mt-6 animate-fade-in opacity-0 delay-400">
            Available for macOS (Apple Silicon & Intel) &middot; Requires OpenCode
          </p>
        </div>

        {/* App Preview */}
        <div className="max-w-5xl mx-auto mt-16 animate-slide-up opacity-0 delay-500">
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-3xl blur-2xl opacity-50" />
            
            {/* Window frame */}
            <div className="relative bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-secondary/50 border-b border-border">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 text-center text-sm text-muted-foreground font-medium">
                  Dilag — Studio
                </div>
                <div className="w-14" />
              </div>
              
              {/* App content preview - Studio layout mockup */}
              <div className="aspect-[16/10] bg-background flex">
                {/* Chat pane mockup */}
                <div className="w-80 border-r border-border p-4 flex flex-col gap-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Chat</div>
                  <div className="flex-1 space-y-3">
                    {/* User message */}
                    <div className="flex justify-end">
                      <div className="bg-primary/10 text-sm px-3 py-2 rounded-lg max-w-[200px]">
                        A habit tracker dashboard with weekly stats
                      </div>
                    </div>
                    {/* AI message */}
                    <div className="flex justify-start">
                      <div className="bg-secondary text-sm px-3 py-2 rounded-lg max-w-[220px]">
                        <span className="text-muted-foreground">Creating your habit tracker with weekly progress rings...</span>
                      </div>
                    </div>
                  </div>
                  {/* Composer */}
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 h-10 bg-secondary/50 rounded-lg border border-border" />
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                      <Wand2 className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                </div>
                
                {/* Canvas mockup */}
                <div className="flex-1 p-8 flex items-center justify-center gap-6" style={{
                  backgroundImage: 'radial-gradient(circle, oklch(0.5 0 0 / 10%) 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }}>
                  {/* Phone frames */}
                  <div className="relative">
                    <div className="w-36 h-72 bg-card rounded-2xl border-2 border-border shadow-lg overflow-hidden">
                      <div className="h-6 bg-secondary/50 flex items-center justify-center">
                        <div className="w-12 h-1.5 bg-foreground/20 rounded-full" />
                      </div>
                      <div className="p-2 space-y-2">
                        <div className="h-8 bg-primary/20 rounded-lg" />
                        <div className="grid grid-cols-2 gap-1">
                          <div className="h-12 bg-secondary rounded" />
                          <div className="h-12 bg-secondary rounded" />
                          <div className="h-12 bg-secondary rounded" />
                          <div className="h-12 bg-secondary rounded" />
                        </div>
                        <div className="h-16 bg-secondary/50 rounded-lg" />
                      </div>
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background px-2">
                      Home
                    </div>
                  </div>
                  
                  <div className="relative">
                    <div className="w-36 h-72 bg-card rounded-2xl border-2 border-primary/50 shadow-lg shadow-primary/10 overflow-hidden">
                      <div className="h-6 bg-secondary/50 flex items-center justify-center">
                        <div className="w-12 h-1.5 bg-foreground/20 rounded-full" />
                      </div>
                      <div className="p-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary/30 rounded-full" />
                          <div className="flex-1 h-4 bg-secondary rounded" />
                        </div>
                        <div className="h-20 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full border-4 border-primary/50" />
                        </div>
                        <div className="space-y-1">
                          <div className="h-3 bg-secondary rounded w-3/4" />
                          <div className="h-3 bg-secondary rounded w-1/2" />
                        </div>
                      </div>
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs text-primary bg-background px-2 font-medium">
                      Stats
                    </div>
                  </div>
                  
                  <div className="relative opacity-60">
                    <div className="w-36 h-72 bg-card rounded-2xl border-2 border-border shadow-lg overflow-hidden">
                      <div className="h-6 bg-secondary/50 flex items-center justify-center">
                        <div className="w-12 h-1.5 bg-foreground/20 rounded-full" />
                      </div>
                      <div className="p-2 space-y-2">
                        <div className="h-6 bg-secondary rounded w-2/3" />
                        <div className="space-y-1.5">
                          <div className="h-10 bg-secondary/70 rounded" />
                          <div className="h-10 bg-secondary/70 rounded" />
                          <div className="h-10 bg-secondary/70 rounded" />
                        </div>
                      </div>
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background px-2">
                      Settings
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              From idea to UI in seconds
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Dilag turns your app descriptions into pixel-perfect mobile screens using AI.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                1
              </div>
              <div className="p-8 rounded-2xl bg-card border border-border h-full">
                <MessageSquare className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3">Describe your app</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Type a natural language prompt like &quot;A meditation app with a breathing timer and session history&quot;
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                2
              </div>
              <div className="p-8 rounded-2xl bg-card border border-border h-full">
                <Wand2 className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3">AI generates screens</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Watch in real-time as the AI creates multiple mobile screens with proper layouts and styling
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                3
              </div>
              <div className="p-8 rounded-2xl bg-card border border-border h-full">
                <Layers className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-3">Iterate and refine</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Continue the conversation to add features, change colors, or adjust layouts on any screen
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Built for designers and developers
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A native macOS experience with powerful features for rapid prototyping.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature cards */}
            <div className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Live Preview</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                See your designs rendered in realistic iPhone frames as they&apos;re generated
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Multi-Screen Canvas</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Drag, zoom, and organize multiple screens on an infinite canvas
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Conversational UI</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Refine your designs through natural conversation with the AI
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Palette className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Real HTML Output</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Generates actual HTML/CSS you can export and use in your projects
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Multiple AI Models</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Choose from Claude, GPT, Gemini, and more through OpenCode
              </p>
            </div>

            <div className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Wand2 className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Project Management</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Save and resume your design sessions with full history
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative p-12 rounded-3xl overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-card to-accent/10" />
            <div className="absolute inset-0 border border-border rounded-3xl" />
            
            <div className="relative text-center">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Start designing with AI
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Download Dilag and turn your app ideas into beautiful mobile interfaces.
              </p>
              <a
                href="https://github.com/noelrohi/dilag/releases/latest"
                className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-xl text-lg font-semibold hover:opacity-90 transition-opacity"
              >
                <Download className="w-5 h-5" />
                Download for macOS
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DilagLogo className="w-6 h-6" />
            <span className="text-sm text-muted-foreground">
              Built by{" "}
              <a
                href="https://github.com/noelrohi"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-primary transition-colors"
              >
                @noelrohi
              </a>
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a
              href="https://github.com/noelrohi/dilag"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/noelrohi/dilag/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Releases
            </a>
            <a
              href="https://opencode.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              OpenCode
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
