import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { initI18n } from '../../i18n';
import { ModeTabs } from '../ModeTabs';
import { TechPanel } from '../TechPanel';

beforeAll(() => {
  initI18n('en');
});

describe('TechPanel', () => {
  it('renders title, status and formatted values', async () => {
    await render(
      <TechPanel
        title="TECHNICAL DATA"
        status={{ text: 'Stable', tone: 'ok' }}
        cells={[
          { key: 'angle', label: 'Angle', value: '+1.10°' },
          { key: 'slope', label: 'Slope', value: '1.92%' },
          { key: 'ratio', label: 'Ratio', value: '1:52.1' },
        ]}
      />,
    );
    expect(screen.getByText('TECHNICAL DATA')).toBeTruthy();
    expect(screen.getByText('Stable')).toBeTruthy();
    expect(screen.getByText('+1.10°')).toBeTruthy();
    expect(screen.getByText('1.92%')).toBeTruthy();
    expect(screen.getByText('1:52.1')).toBeTruthy();
  });
});

describe('ModeTabs', () => {
  it('calls onChange with the tapped mode and onAuto for Auto', async () => {
    const onChange = jest.fn();
    const onAuto = jest.fn();
    await render(<ModeTabs value="edge" onChange={onChange} auto onAuto={onAuto} />);
    await fireEvent.press(screen.getByText('Flat'));
    expect(onChange).toHaveBeenCalledWith('flat');
    await fireEvent.press(screen.getByText('Auto'));
    expect(onAuto).toHaveBeenCalled();
  });

  it('marks the active tab as selected', async () => {
    await render(<ModeTabs value="flat" onChange={jest.fn()} auto={false} onAuto={jest.fn()} />);
    expect(screen.getByRole('tab', { name: 'Flat' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('tab', { name: 'Edge' }).props.accessibilityState).toMatchObject({ selected: false });
  });
});
