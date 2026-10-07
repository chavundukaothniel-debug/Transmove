export function renderAvailabilityCalendar(ranges, month=new Date()) {
 const first=new Date(Date.UTC(month.getFullYear(),month.getMonth(),1)),count=new Date(Date.UTC(month.getFullYear(),month.getMonth()+1,0)).getUTCDate();
 let html='<div class="availability-calendar"><h4>'+first.toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})+'</h4><div class="availability-days">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>'<strong>'+d+'</strong>').join('');
 for(let i=0;i<(first.getUTCDay()+6)%7;i++)html+='<span></span>';
 for(let day=1;day<=count;day++) {
  const start=Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),day),end=start+86400000;
  const booked=ranges.some(r=>new Date(r.start_date).getTime()<end&&new Date(r.end_date).getTime()>start);
  html+='<span class="'+(booked?'booked':'available')+'" title="'+(booked?'Booked for part or all of this day':'No confirmed hire')+'">'+day+'</span>';
 }
 return html+'</div><p>Red: booked for part or all of the day. Other dates have no confirmed hire. The owner confirms your request.</p></div>';
}
