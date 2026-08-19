import React from 'react';
import CreateMeetingModal from './CreateMeetingModal';

type CreateProps = React.ComponentProps<typeof CreateMeetingModal>;

const ScheduleMeetingModal: React.FC<Omit<CreateProps, 'mode'>> = (props) => (
  <CreateMeetingModal {...props} mode="scheduled" />
);

export default ScheduleMeetingModal;
