"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorText } from "@/lib/api";
import { useBoMutation } from "@/lib/backoffice";
import type { LoyaltyPerk, RewardRow } from "@/lib/types";
import { Btn } from "@/components/ui/btn";
import { Card, ErrorNote, Toggle, labelCls } from "@/components/ui/bits";
import { Field, TextInput } from "@/components/ui/form";
import { Segmented } from "@/components/ui/glass-tabs";
import { Loadable, Select } from "../common";
import { int, keys } from "./shared";

// Welcome and birthday perks: points, stamps and/or a coupon, given once per member (birthday: once a year)

function PerkCard({ perk, rewards }: { perk: LoyaltyPerk; rewards: RewardRow[] }) {
  const welcome = perk.kind === "WELCOME";
  const [active, setActive] = useState(perk.is_active);
  const [trigger, setTrigger] = useState(perk.trigger);
  const [points, setPoints] = useState(String(perk.grant_points));
  const [stamps, setStamps] = useState(String(perk.grant_stamps));
  const [rewardId, setRewardId] = useState(perk.reward_id ?? "");
  const [days, setDays] = useState(String(perk.coupon_valid_days));
  const [message, setMessage] = useState(perk.send_message);

  const body = {
    is_active: active,
    ...(welcome && { trigger }),
    grant_points: int(points) ?? 0,
    grant_stamps: int(stamps) ?? 0,
    reward_id: rewardId || null,
    coupon_valid_days: int(days) ?? 30,
    ...(!welcome && { send_message: message }),
  };
  const gives = body.grant_points > 0 || body.grant_stamps > 0 || !!body.reward_id;
  const save = useBoMutation(() => api.post(`/loyalty/admin/perks/${perk.kind}/update`, body), [keys.perks]);

  return (
    <Card pad={16} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={labelCls}>{welcome ? "Welcome bonus" : "Birthday reward"}</div>
          <div className="mt-1 text-[12.5px] text-muted">{welcome ? "For new members, once." : "Once a year, on the member's birthday (asked when they join). Sent by the daily job."}</div>
        </div>
        <Toggle on={active} onChange={setActive} />
      </div>
      {welcome && (
        <Field label="Given">
          <Segmented<"JOIN" | "FIRST_CLAIM">
            value={trigger}
            onChange={setTrigger}
            options={[
              { value: "JOIN", label: "When they join" },
              { value: "FIRST_CLAIM", label: "On first receipt" },
            ]}
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Points">
          <TextInput value={points} onChange={setPoints} inputMode="numeric" mono />
        </Field>
        <Field label="Stamps">
          <TextInput value={stamps} onChange={setStamps} inputMode="numeric" mono />
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label="Coupon (optional)" hint="A reward given for free">
          <Select value={rewardId} onChange={setRewardId}>
            <option value="">No coupon</option>
            {rewards.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.is_active ? "" : " (inactive)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Valid for">
          <TextInput value={days} onChange={setDays} inputMode="numeric" suffix="days" mono />
        </Field>
      </div>
      {!welcome && (
        <div className="flex items-center justify-between gap-3 text-[13.5px]">
          <span>Send a LINE message (uses the message quota)</span>
          <Toggle on={message} onChange={setMessage} />
        </div>
      )}
      {active && !gives && <div className="text-[12px] text-persimmon-2">Turned on but gives nothing — add points, stamps or a coupon.</div>}
      <div className="flex justify-end">
        <Btn kind="primary" size="sm" disabled={save.isPending} onClick={() => save.mutate(undefined)}>
          {save.isPending ? "Saving…" : "Save"}
        </Btn>
      </div>
      {save.isError && <ErrorNote>{errorText(save.error)}</ErrorNote>}
    </Card>
  );
}

export function PerksTab() {
  const perks = useQuery({ queryKey: keys.perks, queryFn: () => api.get<LoyaltyPerk[]>("/loyalty/admin/perks") });
  const rewards = useQuery({ queryKey: keys.rewards, queryFn: () => api.get<RewardRow[]>("/loyalty/admin/rewards") });
  return (
    <Loadable queries={[perks, rewards]}>
      {() => (
        <div className="grid gap-3.5 lg:grid-cols-2">
          {perks.data!.map((p) => (
            <PerkCard key={`${p.kind}-${p.update_at ?? ""}`} perk={p} rewards={rewards.data!} />
          ))}
        </div>
      )}
    </Loadable>
  );
}
