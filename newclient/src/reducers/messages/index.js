import { Map } from 'immutable';
import * as types from '../../actions/messages/types';

const initialState = {
  messages: Map() // eslint-disable-line new-cap
};

export default function messages(state = initialState, action) {
  switch (action.type) {
    case types.ADD_MESSAGE_SERVER: {
      return {
        messages: state.messages.set(action.data.gid, action.data)
      };
    }
    default:
      return state;
  }
}
