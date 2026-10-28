"use client";
import { useCallback, useEffect, useState } from "react";
import { demoProducts, groupLinesByStation, initialDemoState, nextDemoOrderNumber } from "./types";
import type { DemoOrder, TicketStatus } from "./types";
export type DiningTableOption = { id: string; tableNumber: string; zone: string };
const STORE = "restoplus.demo.commandes.workflow";
const TABLES: DiningTableOption[] = ["01","02","03","04","05","06"].map((n)=>({id:`t${n}`,tableNumber:`Table ${n}`,zone:"STANDARD"}));
export function useOrdersWorkflow() {
  const [orders,setOrders]=useState<DemoOrder[]>([]); const [loaded,setLoaded]=useState(false); const [error,setError]=useState<string|null>(null); const [refreshing,setRefreshing]=useState(false);
  const save=useCallback((next:DemoOrder[])=>{setOrders(next);localStorage.setItem(STORE,JSON.stringify({orders:next}));},[]);
  const refresh=useCallback(()=>{setRefreshing(true);try{const saved=localStorage.getItem(STORE);setOrders(saved?(JSON.parse(saved).orders as DemoOrder[]):initialDemoState.orders);setError(null);}catch{setOrders(initialDemoState.orders);}finally{setLoaded(true);setRefreshing(false);}},[]);
  useEffect(()=>{const timer=window.setTimeout(refresh,0);return()=>window.clearTimeout(timer);},[refresh]);
  const submitOrder=useCallback(async(table:string,lines:Array<{id:string;quantity:number}>,notes?:string)=>{const mapped=lines.flatMap(({id,quantity})=>{const product=demoProducts.find(item=>item.id===id);return product?[{...product,quantity}]:[];});if(!mapped.length)throw new Error("Choisissez au moins un article.");const order:DemoOrder={id:`demo-${Date.now()}`,number:nextDemoOrderNumber(orders),table,createdBy:"Équipe démo",createdAt:new Date().toISOString(),status:"WAITING_CASHIER",lines:mapped,tickets:[]};save([order,...orders]);setError(notes?`Note ajoutée : ${notes}`:null);return order.id;},[orders,save]);
  const validateAtCashier=useCallback(async(orderId:string)=>{save(orders.map(order=>order.id===orderId?{...order,status:"IN_PREPARATION",cashierValidatedAt:new Date().toISOString(),tickets:groupLinesByStation(order.lines).map((group,index)=>({id:`${order.id}-ticket-${index}`,number:`BON-${order.number}-${index+1}`,station:group.station,status:"PENDING",items:group.items,issuedAt:new Date().toISOString()}))}:order));},[orders,save]);
  const updateTicket=useCallback(async(orderId:string,ticketId:string,status:TicketStatus)=>{save(orders.map(order=>{if(order.id!==orderId)return order;const tickets=order.tickets.map(ticket=>ticket.id===ticketId?{...ticket,status}:ticket);return {...order,tickets,status:tickets.length&&tickets.every(ticket=>ticket.status==="READY")?"READY":order.status};}));},[orders,save]);
  return {orders,tables:TABLES,loaded,isLive:false,error,refreshing,refresh,submitOrder,validateAtCashier,updateTicket};
}
