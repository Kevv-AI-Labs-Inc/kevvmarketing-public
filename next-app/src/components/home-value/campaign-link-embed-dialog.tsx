"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/i18n";
import { Code, Copy } from "lucide-react";
import { toast } from "sonner";
import { generateIframeSnippet, generateScriptSnippet } from "@/lib/embed";

export function CampaignLinkEmbedDialog({
  directUrl,
  label,
}: {
  directUrl: string;
  label: string;
}) {
  const { t } = useT();
  const iframeCode = generateIframeSnippet(directUrl);
  const scriptCode = generateScriptSnippet(directUrl);

  function handleCopy(code: string, type: string) {
    navigator.clipboard.writeText(code);
    toast.success(t("homeValueDashboard.campaignLinks.embedCopied"));
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={t("homeValueDashboard.campaignLinks.copyEmbed")}
        >
          <Code className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            {t("homeValueDashboard.campaignLinks.embedTitle")}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {t("homeValueDashboard.campaignLinks.embedDescription")}
        </p>
        <Tabs defaultValue="iframe">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="iframe" className="text-xs">
              {t("homeValueDashboard.campaignLinks.iframeSnippet")}
            </TabsTrigger>
            <TabsTrigger value="script" className="text-xs">
              {t("homeValueDashboard.campaignLinks.scriptSnippet")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="iframe">
            <div className="relative">
              <pre className="rounded-lg border bg-muted/30 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {iframeCode}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => handleCopy(iframeCode, "iframe")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="script">
            <div className="relative">
              <pre className="rounded-lg border bg-muted/30 p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                {scriptCode}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => handleCopy(scriptCode, "script")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
