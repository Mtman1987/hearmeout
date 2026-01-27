'use client';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/app/components/Logo";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useFirebase } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
import { useRouter } from 'next/navigation';


const DiscordIcon = () => (
    <svg role="img" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M16.29 5.23a10.08 10.08 0 0 0-2.2-.62.84.84 0 0 0-1 .75c.18.25.36.5.52.75a8.62 8.62 0 0 0-4.14 0c.16-.25.34-.5.52-.75a.84.84 0 0 0-1-.75 10.08 10.08 0 0 0-2.2.62.81.81 0 0 0-.54.78c-.28 3.24.78 6.28 2.82 8.25a.85.85 0 0 0 .93.12 7.55 7.55 0 0 0 1.45-.87.82.82 0 0 1 .9-.06 6.53 6.53 0 0 0 2.22 0 .82.82 0 0 1 .9.06 7.55 7.55 0 0 0 1.45.87.85.85 0 0 0 .93-.12c2.04-1.97 3.1-5 2.82-8.25a.81.81 0 0 0-.55-.78zM10 11.85a1.45 1.45 0 0 1-1.45-1.45A1.45 1.45 0 0 1 10 8.95a1.45 1.45 0 0 1 1.45 1.45A1.45 1.45 0 0 1 10 11.85zm4 0a1.45 1.45 0 0 1-1.45-1.45A1.45 1.45 0 0 1 14 8.95a1.45 1.45 0 0 1 1.45 1.45A1.45 1.45 0 0 1 14 11.85z"/>
    </svg>
);

const TwitchIcon = () => (
    <svg role="img" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.149 0L.537 4.119v16.845h5.373V24l4.298-2.985h3.582L22.388 12V0H2.149zm19.104 11.194l-3.582 3.582H14.18l-3.209 3.209v-3.209H5.91V1.493h15.343v9.701zM11.94 4.119h2.149v5.373h-2.149V4.119zm-5.373 0h2.149v5.373H6.567V4.119z"/>
    </svg>
);

export default function LoginPage() {
  const { auth } = useFirebase();
  const router = useRouter();

  const handleGuestLogin = () => {
    if (auth) {
      signInAnonymously(auth)
        .then(() => {
          router.push('/');
        })
        .catch((error) => {
          console.error("Anonymous sign-in failed", error);
        });
    }
  };

  const handleDiscordLogin = () => {
    // In a real app, this would initiate the Discord OAuth2 flow.
    // For now, we will simulate a login by just redirecting.
    // A full implementation would involve:
    // 1. Redirecting to Discord's authorization URL.
    // 2. Handling the redirect back to your app with an auth code.
    // 3. Exchanging the code for a token on your backend.
    // 4. Creating a custom Firebase token and signing in.
    alert("This would start the Discord login process. For now, you will stay a guest.");
    handleGuestLogin();
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-secondary p-4 relative">
        <Button variant="ghost" asChild className="absolute top-4 left-4">
            <Link href="/">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to Home
            </Link>
        </Button>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Logo />
          </div>
          <CardTitle className="font-headline text-2xl">Join the Conversation</CardTitle>
          <CardDescription>
            Sign in to create rooms and start listening.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Button variant="outline" className="w-full" onClick={handleDiscordLogin}>
            <DiscordIcon />
            <span className="ml-2">Continue with Discord</span>
          </Button>
          <Button variant="outline" className="w-full">
            <TwitchIcon />
            <span className="ml-2">Continue with Twitch</span>
          </Button>
           <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                Or
                </span>
            </div>
        </div>
        <Button variant="secondary" className="w-full" onClick={handleGuestLogin}>
            Continue as Guest
        </Button>
        </CardContent>
      </Card>
    </div>
  );
}
