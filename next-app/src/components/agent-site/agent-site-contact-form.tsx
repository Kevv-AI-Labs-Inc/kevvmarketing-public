"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

type AgentSiteContactFormProps = {
  agentSlug: string;
  agentName: string;
  accentClassName: string;
};

export function AgentSiteContactForm({
  agentSlug,
  agentName,
  accentClassName,
}: AgentSiteContactFormProps) {
  const submitMutation = trpc.profile.submitInquiry.useMutation();
  const [formData, setFormData] = useState({
    senderName: "",
    senderEmail: "",
    senderPhone: "",
    subject: "Property inquiry",
    message: "",
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await submitMutation.mutateAsync({
        slug: agentSlug,
        ...formData,
      });
      toast.success(`Lead sent to ${agentName}`);
      setFormData({
        senderName: "",
        senderEmail: "",
        senderPhone: "",
        subject: "Property inquiry",
        message: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send inquiry.");
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Input
          required
          placeholder="Your name"
          value={formData.senderName}
          onChange={(event) =>
            setFormData((current) => ({ ...current, senderName: event.target.value }))
          }
        />
        <Input
          required
          type="email"
          placeholder="Email"
          value={formData.senderEmail}
          onChange={(event) =>
            setFormData((current) => ({ ...current, senderEmail: event.target.value }))
          }
        />
      </div>
      <Input
        placeholder="Phone"
        value={formData.senderPhone}
        onChange={(event) =>
          setFormData((current) => ({ ...current, senderPhone: event.target.value }))
        }
      />
      <Input
        required
        placeholder="Subject"
        value={formData.subject}
        onChange={(event) =>
          setFormData((current) => ({ ...current, subject: event.target.value }))
        }
      />
      <Textarea
        required
        rows={5}
        placeholder={`Tell ${agentName.split(" ")[0]} what you need.`}
        value={formData.message}
        onChange={(event) =>
          setFormData((current) => ({ ...current, message: event.target.value }))
        }
      />
      <Button
        className={`w-full ${accentClassName}`}
        disabled={submitMutation.isPending}
        type="submit"
      >
        {submitMutation.isPending ? "Sending..." : "Send inquiry"}
      </Button>
    </form>
  );
}
