"use client";

import { ComponentExample } from "@/components/component-example";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

export default function Page() {
  const tasks = useQuery(api.tasks.get);
  return (
    <div>
      <ComponentExample />
      {tasks?.map((task) => (
        <div key={task._id}>{task.text}</div>
      ))}
    </div>
  );
}
