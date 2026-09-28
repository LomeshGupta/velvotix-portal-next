import Link from 'next/link';
import { Button } from '@mui/material';
import TicketDetail from '@/components/TicketDetail';
export default function Page({ params }: { params: { id: string } }) {
  return <><Button component={Link} href="/portal/tickets" sx={{ m: 2, mb: 0 }}>Back to my tickets</Button><TicketDetail id={params.id} staff={false} /></>;
}
