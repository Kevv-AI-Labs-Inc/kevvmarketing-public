"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n/messages";
import {
  Calendar,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Phone,
  PhoneOff,
  ThumbsDown,
  Voicemail,
} from "lucide-react";
import { toast } from "sonner";
import type { ProspectFeedback } from "@/lib/db/schema";

type Outcome =
  | "called"
  | "appointment_booked"
  | "not_interested"
  | "no_answer"
  | "voicemail"
  | "callback_scheduled";

type Channel = "call" | "sms" | "email" | "postcard";

const outcomeOptions: Array<{
  value: Outcome;
  labelKey: MessageKey;
  icon: React.ElementType;
}> = [
  { value: "called", labelKey: "prospecting.outcomeCalled", icon: Phone },
  { value: "appointment_booked", labelKey: "prospecting.outcomeBooked", icon: Calendar },
  { value: "not_interested", labelKey: "prospecting.outcomeNotInterested", icon: ThumbsDown },
  { value: "no_answer", labelKey: "prospecting.outcomeNoAnswer", icon: PhoneOff },
  { value: "voicemail", labelKey: "prospecting.outcomeVoicemail", icon: Voicemail },
  { value: "callback_scheduled", labelKey: "prospecting.outcomeCallback", icon: MessageSquare },
];

export function FeedbackPanel({
  briefId,
  existingFeedback,
}: {
  briefId: number;
  existingFeedback: ProspectFeedback | null;
}) {
  const { t } = useT();
  const utils = trpc.useUtils();

  const [outcome, setOutcome] = useState<Outcome | "">(
    (existingFeedback?.outcome as Outcome) ?? ""
  );
  const [channel, setChannel] = useState<Channel | "">(
    (existingFeedback?.outreachChannel as Channel) ?? ""
  );
  const [notes, setNotes] = useState(existingFeedback?.notes ?? "");

  const submitMutation = trpc.prospecting.submitFeedback.useMutation({
    onSuccess: () => {
      toast.success(t("prospecting.feedbackSaved"));
      utils.prospecting.getBrief.invalidate({ id: briefId });
    },
    onError: (error) => {
      toast.error(t("prospecting.feedbackFailed"), {
        description: error.message,
      });
    },
  });

  function handleSubmit() {
    if (!outcome) return;
    submitMutation.mutate({
      briefId,
      outcome: outcome as Outcome,
      outreachChannel: channel ? (channel as Channel) : undefined,
      notes: notes.trim() || undefined,
    });
  }

  const hasFeedback = !!existingFeedback;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          {t("prospecting.logOutcome")}
          {hasFeedback && (
            <span className="text-xs font-normal text-muted-foreground">
              ({t("prospecting.feedbackRecorded")})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {/* Outcome buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {outcomeOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = outcome === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setOutcome(opt.value)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "hover:bg-accent"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t(opt.labelKey)}</span>
                </button>
              );
            })}
          </div>

          {/* Channel */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
              {t("prospecting.outreachChannel")}
            </span>
            <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder={t("prospecting.selectChannel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">{t("prospecting.call")}</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="postcard">{t("prospecting.postcard")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <Textarea
            placeholder={t("prospecting.notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="text-sm"
          />

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!outcome || submitMutation.isPending}
            className="self-end"
          >
            {submitMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {hasFeedback
              ? t("prospecting.updateFeedback")
              : t("prospecting.saveFeedback")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
