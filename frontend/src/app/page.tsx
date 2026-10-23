"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getUserId } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getUserId() ? "/dashboard" : "/login");
  }, [router]);
  return null;
}
