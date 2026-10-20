"use client";

import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";
import { Section } from "@/components/Section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskDoneButton } from "@/components/TaskDoneButton";
import { relTime } from "@/lib/utils";
import { ShowingApprovalCard, type ShowingRequestRow } from "./ShowingApprovalCard";

export type AriaTaskRow = {
  id: string;
  kind: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  createdAt: string;
};

function TaskRow({ task }: { task: AriaTaskRow }) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <MessageSquareWarning className="size-3.5 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-body font-semibold text-foreground">{task.title}</p>
        <p className="font-display text-caption text-muted-foreground">{relTime(task.createdAt)}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {task.clientId ? (
          <Button asChild size="sm">
            <Link href={`/clients/${task.clientId}`}>Open</Link>
          </Button>
        ) : null}
        <TaskDoneButton taskId={task.id} />
      </div>
    </div>
  );
}

/**
 * Today's "Aria needs you" block: showing requests awaiting approval, then
 * conversations Aria handed to the agent. Renders nothing when clear.
 */
export function AriaApprovals({
  showingRequests,
  tasks,
}: {
  showingRequests: ShowingRequestRow[];
  tasks: AriaTaskRow[];
}) {
  if (!showingRequests.length && !tasks.length) return null;
  const count = showingRequests.length + tasks.length;

  return (
    <Section label="Aria needs you" count={count}>
      <div className="space-y-3">
        {showingRequests.map((r) => (
          <ShowingApprovalCard key={r.id} req={r} />
        ))}
        {tasks.length ? (
          <Card className="divide-y divide-border overflow-hidden">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </Card>
        ) : null}
      </div>
    </Section>
  );
}
