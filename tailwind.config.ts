import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				// TelAgri Neon Green Theme Colors
				neon: {
					50: '#f0fdf4',
					100: '#dcfce7',
					200: '#bbf7d0',
					300: '#86efac',
					400: '#4ade80',
					500: '#22c55e',
					600: '#16a34a',
					700: '#15803d',
					800: '#166534',
					900: '#14532d',
					950: '#052e16',
				},
				'neon-glow': '#00ff41',
				'dark-bg': '#0a0a0a',
				'dark-card': '#1a1a1a',
				'dark-border': '#2a2a2a',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// AI Copilot specific colors for enhanced readability
				ai: {
					surface: 'hsl(var(--ai-surface))',
					'surface-elevated': 'hsl(var(--ai-surface-elevated))',
					'text-primary': 'hsl(var(--ai-text-primary))',
					'text-secondary': 'hsl(var(--ai-text-secondary))',
					'text-muted': 'hsl(var(--ai-text-muted))',
					accent: 'hsl(var(--ai-accent))',
					'user-message': 'hsl(var(--ai-user-message))',
					'assistant-message': 'hsl(var(--ai-assistant-message))'
				},
				// Status colors - desaturated for comfort
				success: 'hsl(var(--success))',
				warning: 'hsl(var(--warning))',
				danger: 'hsl(var(--danger))'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'neon-pulse': {
					'0%, 100%': {
						boxShadow: '0 0 5px #00ff41, 0 0 10px #00ff41, 0 0 15px #00ff41'
					},
					'50%': {
						boxShadow: '0 0 10px #00ff41, 0 0 20px #00ff41, 0 0 30px #00ff41'
					}
				},
				'neon-glow': {
					'0%, 100%': {
						textShadow: '0 0 5px #00ff41, 0 0 10px #00ff41'
					},
					'50%': {
						textShadow: '0 0 10px #00ff41, 0 0 20px #00ff41, 0 0 30px #00ff41'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'neon-pulse': 'neon-pulse 2s ease-in-out infinite',
				'neon-glow': 'neon-glow 2s ease-in-out infinite'
			},
			boxShadow: {
				'neon': '0 0 5px #00ff41, 0 0 10px #00ff41, 0 0 15px #00ff41',
				'neon-lg': '0 0 10px #00ff41, 0 0 20px #00ff41, 0 0 30px #00ff41'
			}
		}
	},
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
