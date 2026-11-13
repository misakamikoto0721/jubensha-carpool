function presentSession(doc, dmName) {
  return {
    id: doc._id,
    scriptName: doc.script_name,
    kind: doc.kind === 'weekly' ? 'weekly' : 'private',
    startTime: doc.start_time,
    endTime: doc.end_time || null,
    drawDeadline: doc.draw_deadline || null,
    drawStatus: doc.draw_status === 'done' || doc.status === 'drawn' ? 'done' : (doc.kind === 'weekly' ? 'pending' : 'none'),
    location: doc.location,
    capacity: doc.capacity,
    status: doc.status,
    joinedCount: doc.joined_count || 0,
    applicantCount: doc.applicant_count || (doc.applicant_uids || []).length,
    dmUid: doc.dm_uid,
    dmName: dmName || '',
    createdAt: doc.created_at
  }
}

module.exports = {
  presentSession: presentSession
}
