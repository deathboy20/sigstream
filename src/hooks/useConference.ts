import { useContext } from 'react';
import { ConferenceContext, type ConferenceContextState } from '../contexts/ConferenceContext';

export const useConference = (): ConferenceContextState => {
  const context = useContext(ConferenceContext);
  if (!context) {
    throw new Error('useConference must be used within a ConferenceProvider');
  }
  return context;
};
