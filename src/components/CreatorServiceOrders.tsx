"use client";

import { useCallback, useEffect, useState } from "react";

type Event = {
  id: string;
  event_type: string;
  message: string;
  file_path?: string;
  created_at: string;
};
type Order = {
  id: string;
  title_snapshot: string;
  brief: string;
  status: string;
  buyer_user_id: string;
  seller_user_id: string;
  revisions_included: number;
  revisions_used: number;
  seller_due_at?: string;
  creator_service_order_events?: Event[];
};

export default function CreatorServiceOrders({ token }: { token: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState<Record<string, string>>({});
  const [delivery, setDelivery] = useState<Record<string, File | null>>({});
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/marketplace/services", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (response.ok) {
      const payload = await response.json();
      setOrders(payload.orders || []);
      setUserId(payload.userId || "");
    }
  }, [token]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const upload = async (orderId: string) => {
    const file = delivery[orderId];
    if (!file) return null;
    const response = await fetch("/api/marketplace/upload/prepare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        files: [
          {
            kind: "delivery",
            name: file.name,
            type: file.type,
            size: file.size,
          },
        ],
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    const slot = payload.slots[0];
    const put = await fetch(slot.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": slot.contentType },
      body: file,
    });
    if (!put.ok) throw new Error("Delivery upload failed.");
    return slot.path as string;
  };
  const act = async (order: Order, action: string) => {
    setNotice("");
    try {
      const filePath = action === "deliver" ? await upload(order.id) : null;
      const response = await fetch("/api/marketplace/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          action,
          message: message[order.id] || "",
          filePath,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setNotice("Service order updated.");
      setMessage({ ...message, [order.id]: "" });
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not update order.",
      );
    }
  };
  const download = async (event: Event) => {
    const response = await fetch(
      `/api/marketplace/services/delivery?eventId=${encodeURIComponent(event.id)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setNotice(payload.error || "Could not open delivery.");
      return;
    }
    const payload = await response.json();
    window.location.assign(payload.url);
  };

  if (!orders.length)
    return (
      <p className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">
        Paid creator-service orders will appear here for buyers and service
        providers.
      </p>
    );
  return (
    <div className="mt-4 space-y-4">
      {notice && (
        <p className="rounded-xl border border-brand/30 p-3 text-sm">
          {notice}
        </p>
      )}
      {orders.map((order) => {
        const buyer = order.buyer_user_id === userId,
          seller = order.seller_user_id === userId;
        const actions = [
          seller && order.status === "paid_waiting_seller" && "accept",
          seller &&
            ["accepted", "revision_requested"].includes(order.status) &&
            "start",
          seller &&
            ["accepted", "in_progress", "revision_requested"].includes(
              order.status,
            ) &&
            "deliver",
          buyer &&
            order.status === "delivered" &&
            order.revisions_used < order.revisions_included &&
            "revision_requested",
          buyer && order.status === "delivered" && "completed",
          ["paid_waiting_seller", "accepted", "in_progress"].includes(
            order.status,
          ) && "cancel_requested",
          [
            "accepted",
            "in_progress",
            "delivered",
            "revision_requested",
            "cancel_requested",
          ].includes(order.status) && "dispute",
          "message",
        ].filter(Boolean) as string[];
        return (
          <article
            key={order.id}
            className="rounded-xl border border-white/10 p-4"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <h3 className="font-semibold">{order.title_snapshot}</h3>
              <span className="text-sm capitalize text-brand">
                {order.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              <span className="text-text-primary">Brief:</span> {order.brief}
            </p>
            <p className="mt-2 text-xs text-text-secondary">
              You are the {buyer ? "client" : "service provider"} · Revisions{" "}
              {order.revisions_used}/{order.revisions_included}
              {order.seller_due_at
                ? ` · target ${new Date(order.seller_due_at).toLocaleDateString()}`
                : ""}
            </p>
            <div className="mt-4 space-y-2">
              {(order.creator_service_order_events || []).map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg bg-white/[.03] p-3 text-xs"
                >
                  <span className="capitalize text-brand">
                    {event.event_type.replaceAll("_", " ")}
                  </span>
                  {event.message && (
                    <p className="mt-1 text-text-secondary">{event.message}</p>
                  )}
                  {event.file_path && (
                    <button
                      type="button"
                      onClick={() => void download(event)}
                      className="mt-2 rounded-full border border-white/20 px-3 py-1"
                    >
                      Download private delivery
                    </button>
                  )}
                </div>
              ))}
            </div>
            <textarea
              value={message[order.id] || ""}
              onChange={(event) =>
                setMessage({ ...message, [order.id]: event.target.value })
              }
              placeholder="Message, delivery note or revision details"
              className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
            />
            {seller && (
              <label className="mt-3 block text-xs text-text-secondary">
                Delivery file
                <input
                  type="file"
                  onChange={(event) =>
                    setDelivery({
                      ...delivery,
                      [order.id]: event.target.files?.[0] || null,
                    })
                  }
                  className="mt-2 block"
                />
              </label>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => void act(order, action)}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs capitalize hover:border-brand"
                >
                  {action.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
