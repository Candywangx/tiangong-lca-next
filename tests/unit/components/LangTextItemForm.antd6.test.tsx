import LangTextItemForm from '@/components/LangTextItem/form';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, Form } from 'antd';

type FormInstance = import('antd').FormInstance;

let mockLocale = 'zh-CN';

jest.mock('umi', () => ({
  FormattedMessage: ({ defaultMessage, id }: any) => defaultMessage ?? id,
  useIntl: () => ({
    locale: mockLocale,
    formatMessage: ({ defaultMessage, id }: any) => defaultMessage ?? id,
  }),
}));

jest.mock('@ant-design/icons', () => ({
  ...jest.requireActual('@ant-design/icons'),
  CloseOutlined: ({ onClick }: any) => (
    <button type='button' aria-label='Remove language' onClick={onClick} />
  ),
}));

const languages = () =>
  Array.from(document.querySelectorAll('[data-content-language]')).map((row) =>
    row.getAttribute('data-content-language'),
  );

function renderNativeForm(required = false) {
  let form: FormInstance;
  function Harness() {
    [form] = Form.useForm();
    return (
      <App>
        <Form form={form} initialValues={{ translations: [] }}>
          <LangTextItemForm
            name={['translations']}
            label='Translation'
            rules={required ? [{ required: true }] : []}
          />
        </Form>
      </App>
    );
  }
  return { ...render(<Harness />), getForm: () => form!, Harness };
}

afterEach(() => {
  mockLocale = 'zh-CN';
});

it('keeps untouched optional defaults valid after the UI language changes', async () => {
  const { getForm, rerender, Harness } = renderNativeForm(true);
  await waitFor(() => expect(languages()).toEqual(['zh', 'en']));
  await act(async () => {
    getForm().setFieldValue(['translations', 1, '#text'], 'English text');
  });
  await act(async () => {
    await expect(getForm().validateFields()).resolves.toMatchObject({
      translations: [{ '@xml:lang': 'zh' }, { '@xml:lang': 'en', '#text': 'English text' }],
    });
  });
  mockLocale = 'fr-FR';
  rerender(<Harness />);
  await waitFor(() => expect(languages()).toEqual(['fr', 'en', 'zh']));
  await act(async () => {
    await expect(getForm().validateFields()).resolves.toMatchObject({
      translations: [
        { '@xml:lang': 'zh' },
        { '@xml:lang': 'en', '#text': 'English text' },
        { '@xml:lang': 'fr' },
      ],
    });
  });
});

it('restores default languages on reset after an optional row was deliberately removed', async () => {
  const { getForm } = renderNativeForm();
  await waitFor(() => expect(languages()).toEqual(['zh', 'en']));
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove language' })[0]);
  await waitFor(() => expect(languages()).toEqual(['en']));
  await act(async () => getForm().resetFields());
  await waitFor(() => expect(languages()).toEqual(['zh', 'en']));
});

it('preserves asynchronously loaded translations and edits when the UI language changes', async () => {
  const { getForm, rerender, Harness } = renderNativeForm();
  await waitFor(() => expect(languages()).toEqual(['zh', 'en']));
  const stored = [
    { '@xml:lang': 'en', '#text': 'English text' },
    { '@xml:lang': 'ja', '#text': '日本語' },
  ];
  await act(async () => getForm().setFieldsValue({ translations: stored }));
  await waitFor(() => expect(languages()).toEqual(['zh', 'en', 'ja']));
  await act(async () => getForm().setFieldValue(['translations', 2, '#text'], '中文内容'));
  mockLocale = 'fr-FR';
  rerender(<Harness />);
  await waitFor(() => expect(languages()).toEqual(['fr', 'en', 'ja', 'zh']));
  expect(getForm().getFieldValue(['translations'])).toEqual([
    ...stored,
    { '@xml:lang': 'zh', '#text': '中文内容' },
    { '@xml:lang': 'fr' },
  ]);
});

it('initializes nested records independently without writing language rows at the form root', async () => {
  let form: FormInstance;
  function Harness() {
    [form] = Form.useForm();
    return (
      <App>
        <Form
          form={form}
          initialValues={{
            reviews: [{ notes: [] }, { notes: [{ '@xml:lang': 'en', '#text': 'Second review' }] }],
          }}
        >
          <Form.List name='reviews'>
            {(fields, { remove }) => (
              <>
                <button type='button' onClick={() => remove(0)}>
                  Remove first review
                </button>
                {fields.map((field) => (
                  <LangTextItemForm
                    key={field.key}
                    name={[field.name, 'notes']}
                    listName={['reviews']}
                    label='Notes'
                  />
                ))}
              </>
            )}
          </Form.List>
        </Form>
      </App>
    );
  }
  render(<Harness />);
  await waitFor(() => expect(languages()).toEqual(['zh', 'en', 'zh', 'en']));
  expect(form!.getFieldsValue(true)).toEqual({
    reviews: [
      { notes: [{ '@xml:lang': 'zh' }, { '@xml:lang': 'en' }] },
      { notes: [{ '@xml:lang': 'en', '#text': 'Second review' }, { '@xml:lang': 'zh' }] },
    ],
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove language' })[2]);
  await waitFor(() => expect(languages()).toEqual(['zh', 'en', 'en']));
  fireEvent.click(screen.getByRole('button', { name: 'Remove first review' }));
  await waitFor(() => expect(languages()).toEqual(['en']));
  expect(form!.getFieldValue(['reviews'])).toEqual([
    { notes: [{ '@xml:lang': 'en', '#text': 'Second review' }] },
  ]);
});
