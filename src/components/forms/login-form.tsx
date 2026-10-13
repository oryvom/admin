"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { requestLoginCode, verifyLoginCode } from "@/features/auth/actions";
import { loginCodeSchema, loginIdentifierSchema, type LoginCodeValues } from "@/features/auth/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { z } from "zod";

const identifierFormSchema = z.object({ identifier: loginIdentifierSchema });

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [step, setStep] = useState<"identifier" | "code">("identifier");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const identifierForm = useForm<{ identifier: string }>({
    resolver: zodResolver(identifierFormSchema),
    defaultValues: { identifier: "" },
  });
  const codeForm = useForm<LoginCodeValues>({
    resolver: zodResolver(loginCodeSchema),
    defaultValues: { code: "", next: nextPath },
  });

  async function requestCode(values: { identifier: string }) {
    setError(null);
    setMessage(null);
    const result = await requestLoginCode(values.identifier);
    if (result?.fieldErrors?.identifier) {
      identifierForm.setError("identifier", { message: result.fieldErrors.identifier });
    }
    if (result?.error) {
      setError(result.error);
    }
    if (result?.step === "code") {
      setMessage(result.message ?? null);
      setStep("code");
    }
  }

  async function verifyCode(values: LoginCodeValues) {
    setError(null);
    const result = await verifyLoginCode(values);
    if (result?.error) {
      setError(result.error);
    }
    if (result?.fieldErrors?.code) {
      codeForm.setError("code", { message: result.fieldErrors.code });
    }
  }

  if (step === "code") {
    return (
      <Form {...codeForm}>
        <form className="space-y-4" onSubmit={codeForm.handleSubmit(verifyCode)} noValidate>
          <input type="hidden" {...codeForm.register("next")} />
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <FormField
            control={codeForm.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sign-in code</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" autoComplete="one-time-code" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={codeForm.formState.isSubmitting}>
            {codeForm.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setStep("identifier");
              setError(null);
              setMessage(null);
              codeForm.reset({ code: "", next: nextPath });
            }}
          >
            Use a different email or phone
          </Button>
        </form>
      </Form>
    );
  }

  return (
    <Form {...identifierForm}>
      <form className="space-y-4" onSubmit={identifierForm.handleSubmit(requestCode)} noValidate>
        <FormField
          control={identifierForm.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email or phone</FormLabel>
              <FormControl>
                <Input autoComplete="username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={identifierForm.formState.isSubmitting}>
          {identifierForm.formState.isSubmitting ? "Sending code…" : "Send code"}
        </Button>
      </form>
    </Form>
  );
}
