export const SCHEMA: Record<string, string[]> = {
  Company: ['id','name','legalName','logo','address','city','state','country','pin','gstin','pan','email','phone','website','supportEmail','invoicePrefix','invoiceStart','bankName','accountName','accountNumber','ifsc','branch','terms','footer','cin'],
  Users: ['id','name','email','passwordHash','role','customerId','active','createdAt','isSeed'],
  Customers: ['id','companyName','type','gstin','pan','contactPerson','email','phone','altPhone','billingAddress','shippingAddress','city','state','country','pin','status','customerSince','notes','cin'],
  CustomerContacts: ['id','customerId','name','designation','email','phone','mobile','isPrimary','isBilling','isSupport','status'],
  CustomerLogins: ['id','userId','customerId','lastLogin','resetToken','resetExpires'],
  SupportContracts: ['id','customerId','contractNumber','type','startDate','endDate','billingFrequency','amount','tax','total','supportHours','usedHours','remainingHours','sla','prioritySupport','status','renewalDate','notes','createdAt','createdBy'],
  Products: ['id','name','hsnSac','gstPercent','rate','active'],
  Invoices: ['id','number','customerId','date','dueDate','placeOfSupply','gstin','paymentTerms','status','subtotal','discount','taxable','cgst','sgst','igst','roundOff','grandTotal','amountPaid','balanceDue','notes','billingAddress','externalDocNo','orderDate','customerCin'],
  InvoiceItems: ['id','invoiceId','description','hsnSac','qty','rate','discount','taxPercent','taxable','cgst','sgst','igst','lineTotal'],
  Payments: ['id','invoiceId','customerId','date','amount','mode','reference','notes'],
  Tickets: ['id','number','customerId','contactId','subject','description','category','priority','status','assignedTo','contractId','createdAt','updatedAt','resolvedAt','closedAt'],
  TicketMessages: ['id','ticketId','senderUserId','senderType','message','messageType','isInternal','createdAt'],
  TicketActivities: ['id','ticketId','type','detail','userId','createdAt'],
  TicketAttachments: ['id','ticketId','messageId','fileName','driveFileId','url','createdAt'],
  CustomerActivities: ['id','customerId','type','detail','createdAt'],
  Notifications: ['id','userId','type','title','body','read','createdAt'],
  Settings: ['id','key','value'],
  HoursLedger: ['id','customerId','type','hours','validTill','ticketId','requestId','note','createdBy','createdAt'],
  HourRequests: ['id','customerId','ticketId','requestedBy','hours','reason','status','decidedBy','decidedAt','createdAt'],
  AuditLog: ['id','userId','action','entity','entityId','createdAt'],
};
export const ID_PREFIX: Record<string, string> = {
  Customers:'CUST',CustomerContacts:'CONT',Users:'USER',SupportContracts:'CONTRACT',Tickets:'TKT',Invoices:'INV',HoursLedger:'HRL',HourRequests:'HRQ',
};
export type Row = Record<string, string>;
