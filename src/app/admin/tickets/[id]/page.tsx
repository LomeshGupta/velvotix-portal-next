import Link from 'next/link';

import { Button } from '@/components/ui';
import TicketDetail from '@/components/TicketDetail';
export default function Page({ params }: { params: { id: string } }) {
  return <><Button component={Link} href="/admin/tickets" sx={{ m: 2, mb: 0 }}>Back to board</Button><TicketDetail id={params.id} staff /></>;
}
