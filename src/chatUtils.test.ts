import { test, expect } from 'vitest'
import mcData from 'minecraft-data'
import { formatMessage } from './chatUtils'

//@ts-expect-error
globalThis.loadedData ??= mcData('1.20.1')

const mapIncludeDefined = (props) => {
  return (x) => {
    return Object.fromEntries(Object.entries(x).filter(([k, v]) => v !== undefined && props.includes(k)))
  }
}

/*
TODO (nbt)
{
    "extra": [
        {
            "italic": 0,
            "underlined": 0,
            "bold": 0,
            "color": "aqua",
            "obfuscated": 0,
            "strikethrough": 0,
            "text": "minecraft:lift"
        }
    ],
    "text": ""
}
*/

test('formatMessage', () => {
  const result = formatMessage({
    'json': {
      'translate': 'chat.type.announcement',
      'with': [
        {
          'text': 'Server'
        },
        {
          'text': '§cf'
        }
      ]
    },
    'translate': 'chat.type.announcement',
    'with': [
      {
        'json': {
          'text': 'Server'
        },
        'text': 'Server'
      },
      {
        'json': {
          'text': '§cf'
        },
        'text': '§cf'
      }
    ]
  }).map(mapIncludeDefined(['text', 'color']))
  expect(result).toMatchInlineSnapshot(`
    [
      {
        "text": "[",
      },
      {
        "text": "Server",
      },
      {
        "text": "] ",
      },
      {
        "text": "",
      },
      {
        "color": "red",
        "text": "f",
      },
      {
        "text": "",
      },
    ]
  `)
})
