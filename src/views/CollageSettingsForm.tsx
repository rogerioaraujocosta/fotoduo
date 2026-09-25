import React, { useState } from 'react';
import { Form, ActionPanel, Action, useNavigation, Icon } from '@raycast/api';
import { StitchOptions } from '../utils/stitcher';

interface CollageSettingsFormProps {
  currentOptions: StitchOptions;
  onApply: (newOptions: StitchOptions) => void;
}

export const CollageSettingsForm: React.FC<CollageSettingsFormProps> = ({
  currentOptions,
  onApply,
}) => {
  const { pop } = useNavigation();

  const [layout, setLayout] = useState<string>(currentOptions.layout);
  const [cropTop, setCropTop] = useState<string>(String(currentOptions.cropTop));
  const [cropBottom, setCropBottom] = useState<string>(String(currentOptions.cropBottom));
  const [cropSides, setCropSides] = useState<string>(String(currentOptions.cropLeft));
  const [title, setTitle] = useState<string>(currentOptions.title || '');
  const [backgroundColor, setBackgroundColor] = useState<string>(currentOptions.backgroundColor);
  const [gap, setGap] = useState<string>(String(currentOptions.gap));
  const [redactSensitive, setRedactSensitive] = useState<boolean>(!!currentOptions.redactSensitive);

  const handleSubmit = () => {
    const updated: StitchOptions = {
      layout: layout as 'vertical' | 'horizontal',
      cropTop: parseInt(cropTop || '0', 10) || 0,
      cropBottom: parseInt(cropBottom || '0', 10) || 0,
      cropLeft: parseInt(cropSides || '0', 10) || 0,
      cropRight: parseInt(cropSides || '0', 10) || 0,
      gap: parseInt(gap || '16', 10) || 16,
      backgroundColor,
      title: title.trim(),
      redactSensitive,
    };

    onApply(updated);
    pop();
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Aplicar Alterações na Colagem"
            icon={Icon.Check}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="layout"
        title="Disposição dos Prints"
        value={layout}
        onChange={setLayout}
      >
        <Form.Dropdown.Item
          value="vertical"
          title="Empilhado (Vertical) - Ideal para Voo de Ida e Volta"
          icon={Icon.ArrowDown}
        />
        <Form.Dropdown.Item
          value="horizontal"
          title="Lado a Lado (Horizontal)"
          icon={Icon.ArrowRight}
        />
      </Form.Dropdown>

      <Form.TextField
        id="title"
        title="Título da Colagem"
        placeholder="Ex: Detalhes do Voo SP ➔ Paris (Ida e Volta)"
        value={title}
        onChange={setTitle}
        info="Um banner elegante com este texto será desenhado no topo da imagem combinada."
      />

      <Form.Separator />

      <Form.Dropdown
        id="cropTop"
        title="Cortar Topo (Abas do Navegador)"
        value={cropTop}
        onChange={setCropTop}
        info="Remove barras superiores, abas e URL para manter a imagem limpa."
      >
        <Form.Dropdown.Item value="0" title="Sem corte superior (0 px)" />
        <Form.Dropdown.Item value="80" title="Aparar abas do Chrome / Edge (80 px)" />
        <Form.Dropdown.Item value="120" title="Aparar abas + barra de endereço (120 px)" />
        <Form.Dropdown.Item value="160" title="Corte amplo (160 px)" />
      </Form.Dropdown>

      <Form.Dropdown
        id="cropBottom"
        title="Cortar Base (Barra de Tarefas)"
        value={cropBottom}
        onChange={setCropBottom}
        info="Remove a barra de tarefas do Windows se tiver saído na captura."
      >
        <Form.Dropdown.Item value="0" title="Sem corte inferior (0 px)" />
        <Form.Dropdown.Item value="48" title="Aparar barra de tarefas do Windows (48 px)" />
        <Form.Dropdown.Item value="80" title="Corte inferior moderado (80 px)" />
      </Form.Dropdown>

      <Form.Dropdown
        id="cropSides"
        title="Cortar Laterais"
        value={cropSides}
        onChange={setCropSides}
      >
        <Form.Dropdown.Item value="0" title="Sem corte lateral (0 px)" />
        <Form.Dropdown.Item value="20" title="Margem fina (20 px)" />
        <Form.Dropdown.Item value="40" title="Margem média (40 px)" />
      </Form.Dropdown>

      <Form.Separator />

      <Form.Checkbox
        id="redactSensitive"
        label="Adicionar Tarja de Privacidade Central"
        value={redactSensitive}
        onChange={setRedactSensitive}
        info="Aplica uma tarja protetora destacada sobre o centro para ocultar localizadores ou dados pessoais."
      />

      <Form.Dropdown
        id="backgroundColor"
        title="Fundo e Separação"
        value={backgroundColor}
        onChange={setBackgroundColor}
      >
        <Form.Dropdown.Item value="slate" title="Fundo Escuro Moderno (Padrão Fotoduo)" />
        <Form.Dropdown.Item value="black" title="Preto Puro" />
        <Form.Dropdown.Item value="white" title="Branco Puro" />
      </Form.Dropdown>

      <Form.Dropdown
        id="gap"
        title="Espaçamento entre Prints"
        value={gap}
        onChange={setGap}
      >
        <Form.Dropdown.Item value="0" title="Sem espaço (Colados diretamente)" />
        <Form.Dropdown.Item value="16" title="Espaço Médio (16 px)" />
        <Form.Dropdown.Item value="32" title="Espaço Amplo (32 px)" />
      </Form.Dropdown>
    </Form>
  );
};
