export function makeStubAction(commandName: string, detail?: string) {
  return async () => {
    const React = await import('react');
    const ink = await import('ink');
    const {render, Box, Text} = ink;

    render(
      React.createElement(
        Box,
        {flexDirection: 'column'},
        React.createElement(Text, {color: 'cyan'}, `wit ${commandName}`),
        detail ? React.createElement(Text, {dimColor: true}, detail) : null,
        React.createElement(Text, {dimColor: true}, 'Scaffold placeholder (Stage 1).')
      )
    );
  };
}
