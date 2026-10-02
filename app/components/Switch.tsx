import React from 'react';
import { Switch as RNSwitch, SwitchProps } from 'react-native';
import { triggerTapHaptic } from '../utils/haptics';

type Props = SwitchProps & {
  // タップ時の触覚フィードバック（Issue #306）。既定でON。Button/IconButton
  // と同じくLightスタイル。一覧内で複数Switchを連続操作しても、鳴るのは
  // 都度1回（タップ対象のSwitchごと）なので連打による不快感は生じない
  hapticsEnabled?: boolean;
};

export function Switch({ onValueChange, hapticsEnabled = true, ...rest }: Props) {
  function handleValueChange(value: boolean) {
    if (hapticsEnabled) {
      triggerTapHaptic();
    }
    onValueChange?.(value);
  }

  return <RNSwitch onValueChange={handleValueChange} {...rest} />;
}
