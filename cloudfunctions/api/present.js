function presentSession(doc, dmName) {
  return {
    id: doc._id,
    scriptName: doc.script_name,
    startTime: doc.start_time,
    location: doc.location,
    capacity: doc.capacity,
    status: doc.status,
    joinedCount: doc.joined_count || 0,
    dmUid: doc.dm_uid,
    dmName: dmName || '',
    createdAt: doc.created_at
  }
}

module.exports = {
  presentSession: presentSession
}
