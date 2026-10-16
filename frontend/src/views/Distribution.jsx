import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, DataTable, Page, attempt, fmt, toast, useRows } from '../ui';
import { assignmentsQueryKey, createAssignment, getAssignments } from '../api/assignments.api';
import { consumptionQueryKey, getConsumption, recordConsumption } from '../api/consumption.api';
import { isUuid } from '../utils/uuid';

const errorMessage = (error) => error.response?.data?.message || error.response?.data?.error || error.message;

export function DistributionView({ ctx }) {
  const siteId = ctx.site?.id;
  const queryClient = useQueryClient();

  const assignmentsQuery = useQuery({
    queryKey: assignmentsQueryKey(siteId),
    queryFn: () => getAssignments(siteId),
    enabled: isUuid(siteId),
  });
  const consumptionQuery = useQuery({
    queryKey: consumptionQueryKey(siteId),
    queryFn: () => getConsumption(siteId),
    enabled: isUuid(siteId),
  });

  const assignMutation = useMutation({
    mutationFn: (payload) => createAssignment(siteId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assignmentsQueryKey(siteId) });
      queryClient.invalidateQueries({ queryKey: ['analytics', siteId] });
      toast.ok('Material assigned');
      setForm({ itemId: '', qty: '', assignee: '' });
    },
    onError: (err) => toast.err(errorMessage(err)),
  });

  const consumeMutation = useMutation({
    mutationFn: (payload) => recordConsumption(siteId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consumptionQueryKey(siteId) });
      queryClient.invalidateQueries({ queryKey: assignmentsQueryKey(siteId) });
      queryClient.invalidateQueries({ queryKey: ['analytics', siteId] });
      toast.ok('Material marked consumed');
    },
    onError: (err) => toast.err(errorMessage(err)),
  });

  const inventory = useRows(ctx, 'inventory');
  const assignments = useRows(ctx, 'assignments');
  const consumption = useRows(ctx, 'consumption');

  const assignmentList = (isUuid(siteId) && assignmentsQuery.data) ? assignmentsQuery.data : assignments;
  const consumptionList = (isUuid(siteId) && consumptionQuery.data) ? consumptionQuery.data : consumption;

  const [form, setForm] = useState({ itemId: '', qty: '', assignee: '' });
  const available = inventory.filter((item) => item.qty > 0);

  const assign = async (event) => {
    event.preventDefault();
    if (isUuid(siteId)) {
      try {
        await assignMutation.mutateAsync({
          itemId: form.itemId,
          qty: Number(form.qty),
          assignee: form.assignee,
        });
      } catch {
        // error handled in onError
      }
    } else {
      if (attempt(() => ctx.api.post('assignments', form), 'Material assigned')) {
        setForm({ itemId: '', qty: '', assignee: '' });
      }
    }
  };

  const consume = async (assignment) => {
    if (isUuid(siteId)) {
      try {
        await consumeMutation.mutateAsync({
          assignmentId: assignment.id,
          assignmentItemId: assignment.assignmentItemId || undefined,
          qty: assignment.remaining,
          note: 'Marked consumed',
        });
      } catch {
        // error handled in onError
      }
    } else {
      attempt(
        () => ctx.api.post('consumption', {
          assignmentId: assignment.id, qty: assignment.remaining, note: 'Marked consumed',
        }),
        `${assignment.itemName} marked consumed`,
      );
    }
  };

  return (
    <Page title="Material Distribution" sub="View available materials, assign stock to a person or team, and record consumption.">
      <section className="space-y-2">
        <h2 className="font-semibold">1. Available materials</h2>
        <DataTable rows={inventory} columns={[
          { key: 'sku', label: 'SKU' }, { key: 'name', label: 'Material' }, { key: 'category', label: 'Category' },
          { label: 'Available', render: (item) => fmt(item.qty) },
        ]} />
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">2. Assign materials to a person or team</h2>
        <form className="card p-4 grid sm:grid-cols-4 gap-3" onSubmit={assign}>
          <div className="sm:col-span-2"><label className="lbl">Material</label><select className="input" required value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
            <option value="">Select material…</option>{available.map((item) => <option key={item.id} value={item.id}>{item.name || item.sku} · {item.qty} available</option>)}
          </select></div>
          <div><label className="lbl">Quantity</label><input className="input" required type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
          <div><label className="lbl">Assign to</label><input className="input" required value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} /></div>
          <div className="sm:col-span-4"><button className="btn btn-primary" disabled={!available.length}>Assign material</button></div>
        </form>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">3. Mark materials as consumed</h2>
        <DataTable rows={[...assignmentList].reverse()} columns={[
          { key: 'itemName', label: 'Material' }, { key: 'assignee', label: 'Person / team' },
          { key: 'qty', label: 'Assigned' }, { key: 'remaining', label: 'Remaining' },
          { label: 'Status', render: (assignment) => <Badge v={assignment.status} /> },
          { label: '', render: (assignment) => assignment.remaining > 0
            ? <button className="btn btn-sm" onClick={() => consume(assignment)}>Mark consumed</button>
            : '—' },
        ]} />
        <h3 className="font-medium">Consumption history</h3>
        <DataTable rows={[...consumptionList].reverse()} columns={[
          { key: 'itemName', label: 'Material' }, { key: 'qty', label: 'Quantity' },
          { key: 'note', label: 'Note' }, { key: 'by', label: 'Recorded by' },
        ]} />
      </section>
    </Page>);
}
